import os
import json
import copy
import math
import random
import re
from .utils import *
import os
from concurrent.futures import ThreadPoolExecutor, as_completed


response_strict_rule = """
Directly return the final JSON structure. Do not output anything else.

Respond with only the raw JSON object. Do not include markdown code blocks (no ```json tags), do not include introductory text, and do not include concluding remarks. Ensure the JSON is strictly valid.

"""

################### check title in page #########################################################
def normalize_for_title_match(text):
    return re.sub(r'[^a-z0-9]+', '', (text or '').lower())


def title_appears_in_page(title, page_text):
    compact_title = normalize_for_title_match(title)
    if not compact_title:
        return False

    compact_page = normalize_for_title_match(page_text)
    if compact_title in compact_page:
        return True

    title_words = [re.escape(word) for word in re.findall(r'[A-Za-z0-9]+', title or '')]
    if not title_words:
        return False

    flexible_title_pattern = r'\b' + r'\W+'.join(title_words) + r'\b'
    return re.search(flexible_title_pattern, page_text or '', re.IGNORECASE) is not None


def title_starts_page_locally(title, page_text):
    lines = [line.strip() for line in (page_text or '').splitlines() if line.strip()]
    page_start = ' '.join(lines[:3])
    return title_appears_in_page(title, page_start)


def toc_item_identity(item):
    return (
        str(item.get('structure') or '').strip(),
        normalize_for_title_match(item.get('title')),
        item.get('physical_index'),
    )


def deduplicate_toc_items(toc_items, logger=None):
    seen = set()
    deduped_items = []
    removed_count = 0

    for item in toc_items:
        key = toc_item_identity(item)
        if key in seen:
            removed_count += 1
            continue

        seen.add(key)
        deduped_items.append(item)

    if removed_count:
        print(f"Removed {removed_count} duplicate TOC items before validation")
        if logger:
            logger.info({
                "step": "deduplicate_toc_items",
                "removed": removed_count,
                "remaining": len(deduped_items),
            })

    return deduped_items


def find_title_page_locally(title, page_list, start_index, search_center, search_radius=5):
    min_page = max(start_index, search_center - search_radius)
    max_page = min(start_index + len(page_list) - 1, search_center + search_radius)
    for page_number in range(min_page, max_page + 1):
        page_list_index = page_number - start_index
        if 0 <= page_list_index < len(page_list) and title_appears_in_page(title, page_list[page_list_index][0]):
            return page_number
    return None


def normalize_toc_physical_indices(toc_items, page_list, start_index=1, logger=None):
    if not toc_items:
        return toc_items

    max_allowed_page = start_index + len(page_list) - 1
    normalized = []
    last_page = None

    for item in toc_items:
        item = item.copy()
        page_number = item.get('physical_index')
        if page_number is None:
            normalized.append(item)
            continue

        try:
            page_number = int(page_number)
        except (TypeError, ValueError):
            item['physical_index'] = None
            normalized.append(item)
            continue

        if page_number < start_index or page_number > max_allowed_page:
            item['physical_index'] = None
            normalized.append(item)
            continue

        if last_page is not None and page_number < last_page:
            page_number = last_page
            item['physical_index'] = page_number

        normalized.append(item)
        last_page = page_number

    repaired_count = 0
    i = 0
    while i < len(normalized):
        page_number = normalized[i].get('physical_index')
        if page_number is None:
            i += 1
            continue

        run_start = i
        while i < len(normalized) and normalized[i].get('physical_index') == page_number:
            i += 1
        run_length = i - run_start

        if run_length > 3:
            for j in range(run_start, i):
                found_page = find_title_page_locally(
                    normalized[j].get('title', ''),
                    page_list,
                    start_index,
                    page_number,
                )
                if found_page is not None:
                    normalized[j]['physical_index'] = found_page
                    repaired_count += 1

    if repaired_count and logger:
        logger.info({
            "step": "normalize_toc_physical_indices",
            "repaired": repaired_count,
            "remaining": len(normalized),
        })

    return normalized


async def gather_with_limit(coros, limit):
    if not coros:
        return []

    semaphore = asyncio.Semaphore(limit)

    async def run_limited(coro):
        async with semaphore:
            return await coro

    return await asyncio.gather(*(run_limited(coro) for coro in coros))


async def check_title_appearance(item, page_list, start_index=1, model=None, logger=None):
    title=item['title']
    if 'physical_index' not in item or item['physical_index'] is None:
        return {'list_index': item.get('list_index'), 'answer': 'no', 'title':title, 'page_number': None}


    page_number = item['physical_index']
    page_list_index = page_number - start_index
    if page_list_index < 0 or page_list_index >= len(page_list):
        return {'list_index': item.get('list_index'), 'answer': 'no', 'title': title, 'page_number': page_number}

    page_index = page_number - start_index
    print("======================== page_index to Detect title ========================", page_index)
    page_text = page_list[page_index][0]
    if title_appears_in_page(title, page_text):
        return {'list_index': item['list_index'], 'answer': 'yes', 'title': title, 'page_number': page_number}


    prompt = f"""
    Your job is to check if the given section appears or starts in the given page_text.

    Note: do fuzzy matching, ignore any space inconsistency in the page_text.

    The given section title is {title}.
    The given page_text is {page_text}.

    Reply format:
    {{

        "thinking": <why do you think the section appears or starts in the page_text>
        "answer": "yes or no" (yes if the section appears or starts in the page_text, no otherwise)
    }}
    {response_strict_rule}
    """

    print("======================== check_title_appearance llm call ========================")
    response = await llm_acompletion(model=model, prompt=prompt, logger=logger, operation="title_appearance_check")
    response = extract_json(response)
    if 'answer' in response:
        answer = response['answer']
    else:
        answer = 'no'
    return {'list_index': item['list_index'], 'answer': answer, 'title': title, 'page_number': page_number}


async def check_title_appearance_in_start(title, page_text, model=None, logger=None):
    if title_starts_page_locally(title, page_text):
        return "yes"

    prompt = f"""
    You will be given the current section title and the current page_text.
    Your job is to check if the current section starts in the beginning of the given page_text.
    If there are other contents before the current section title, then the current section does not start in the beginning of the given page_text.
    If the current section title is the first content in the given page_text, then the current section starts in the beginning of the given page_text.

    Note: do fuzzy matching, ignore any space inconsistency in the page_text.

    The given section title is {title}.
    The given page_text is {page_text}.

    reply format:
    {{
        "thinking": <why do you think the section appears or starts in the page_text>
        "start_begin": "yes or no" (yes if the section starts in the beginning of the page_text, no otherwise)
    }}
    {response_strict_rule}
    """

    print("======================== check_title_appearance_in_start llm call ========================")
    response = await llm_acompletion(model=model, prompt=prompt, logger=logger, operation="title_start_check")
    response = extract_json(response)
    if logger:
        logger.info(f"Response: {response}")
    return response.get("start_begin", "no")


async def check_title_appearance_in_start_concurrent(structure, page_list, model=None, logger=None):
    if logger:
        logger.info("Checking title appearance in start concurrently")

    seen_pages = set()
    tasks = []
    valid_items = []
    for item in structure:
        page_number = item.get('physical_index')
        if page_number is None:
            item['appear_start'] = 'no'
            continue

        page_list_index = page_number - 1
        if page_list_index < 0 or page_list_index >= len(page_list):
            item['appear_start'] = 'no'
            continue

        # Only the first indexed section on a physical page can start at the
        # beginning of that page. Later sections on the same page are local no.
        if page_number in seen_pages:
            item['appear_start'] = 'no'
            continue
        seen_pages.add(page_number)

        page_text = page_list[page_list_index][0]
        if title_starts_page_locally(item['title'], page_text):
            item['appear_start'] = 'yes'
            continue

        tasks.append(check_title_appearance_in_start(item['title'], page_text, model=model, logger=logger))
        valid_items.append(item)

    if not tasks:
        return structure

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for item, result in zip(valid_items, results):
        if isinstance(result, Exception):
            if logger:
                logger.error(f"Error checking start for {item['title']}: {result}")
            item['appear_start'] = 'no'
        else:
            item['appear_start'] = result

    return structure


def toc_detector_single_page(content, model=None, logger=None):
    prompt = f"""
    Your job is to detect if there is a table of content provided in the given text.

    Given text: {content}

    return the following JSON format:
    {{
        "thinking": <why do you think there is a table of content in the given text>
        "toc_detected": "<yes or no>",
    }}

    {response_strict_rule}
    Please note: abstract,summary, notation list, figure list, table list, etc. are not table of contents."""

    print("======================== toc_detector_single_page llm call ========================")
    response = llm_completion(model=model, prompt=prompt, logger=logger, operation="toc_detector")

    # print('response', response)
    json_content = extract_json(response)
    return json_content['toc_detected']


def looks_like_toc_continuation(content):
    """Detect TOC continuation pages that may lack a Contents heading."""
    if looks_like_toc_candidate(content):
        return True
    if not content:
        return False

    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        return False

    chapter_lines = sum(
        1 for line in lines
        if re.search(r'chapter\s+\d+|^\d+\.\d+', line, re.IGNORECASE)
    )
    page_ref_count = 0
    for line in lines:
        if re.search(r'(\.{2,}|:{1,})\s*(?:[ivxlcdm]+|\d{1,4})\s*$', line, re.IGNORECASE):
            page_ref_count += 1
        elif re.search(r'\s(?:[ivxlcdm]+|\d{1,4})\s*$', line, re.IGNORECASE) and len(line.split()) >= 2:
            page_ref_count += 1

    return chapter_lines >= 2 or page_ref_count >= 3


def looks_like_toc_candidate(content):
    """
    Fast pre-filter before calling the LLM TOC detector.
    A real TOC usually has an explicit contents heading or multiple lines with
    page-number/leader patterns. This avoids treating normal heading-heavy pages
    as TOCs.
    """
    if not content:
        return False

    normalized = content.lower()
    if re.search(r'\b(table\s+of\s+contents|contents)\b', normalized):
        return True

    lines = [line.strip() for line in content.splitlines() if line.strip()]
    page_ref_count = 0
    leader_count = 0
    for line in lines:
        if re.search(r'(\.{2,}|:{1,})\s*(?:[ivxlcdm]+|\d{1,4})\s*$', line, re.IGNORECASE):
            leader_count += 1
            page_ref_count += 1
        elif re.search(r'\s(?:[ivxlcdm]+|\d{1,4})\s*$', line, re.IGNORECASE) and len(line.split()) >= 2:
            page_ref_count += 1

    return leader_count >= 2 or page_ref_count >= 4


def single_page_structure(page_list, doc=None):
    title = None
    if page_list:
        for line in (page_list[0][0] or "").splitlines():
            stripped = line.strip()
            if stripped:
                title = stripped
                break
    if not title:
        title = get_pdf_name(doc) if doc else "Document"

    return [{
        "title": title,
        "start_index": 1,
        "end_index": 1,
    }]


def check_if_toc_extraction_is_complete(content, toc, model=None, logger=None):
    prompt = f"""
    You are given a partial document  and a  table of contents.
    Your job is to check if the  table of contents is complete, which it contains all the main sections in the partial document.

    Reply format:
    {{
        "thinking": <why do you think the table of contents is complete or not>
        "completed": "yes" or "no"
    }}
    {response_strict_rule}
    """

    prompt = prompt + '\n Document:\n' + content + '\n Table of contents:\n' + toc
    print("======================== check_if_toc_extraction_is_complete llm call ========================")
    response = llm_completion(model=model, prompt=prompt, logger=logger, operation="toc_extraction_completeness_check")
    json_content = extract_json(response)
    return json_content.get('completed', 'no')


def check_if_toc_transformation_is_complete(content, toc, model=None, logger=None):
    prompt = f"""
    You are given a raw table of contents and a  table of contents.
    Your job is to check if the  table of contents is complete.

    Reply format:
    {{
        "thinking": <why do you think the cleaned table of contents is complete or not>
        "completed": "yes" or "no"
    }}
    {response_strict_rule}
    """

    prompt = prompt + '\n Raw Table of contents:\n' + content + '\n Cleaned Table of contents:\n' + toc
    print("======================== check_if_toc_transformation_is_complete llm call ========================")
    response = llm_completion(model=model, prompt=prompt, logger=logger, operation="toc_transformation_completeness_check")
    json_content = extract_json(response)
    return json_content.get('completed', 'no')

def extract_toc_content(content, model=None, logger=None):
    prompt = f"""
    Your job is to extract the full table of contents from the given text, replace ... with :

    Given text: {content}

    Directly return the full table of contents content. Do not output anything else."""

    print("======================== extract_toc_content llm call ========================")
    response, finish_reason = llm_completion(model=model, prompt=prompt, return_finish_reason=True, logger=logger, operation="toc_content_extraction")

    if_complete = check_if_toc_transformation_is_complete(content, response, model, logger=logger)
    if if_complete == "yes" and finish_reason == "finished":
        return response

    chat_history = [
        {"role": "user", "content": prompt},
        {"role": "assistant", "content": response},
    ]
    prompt = f"""please continue the generation of table of contents , directly output the remaining part of the structure"""
    print("======================== extract_toc_content llm call ========================")
    new_response, finish_reason = llm_completion(model=model, prompt=prompt, chat_history=chat_history, return_finish_reason=True, logger=logger, operation="toc_content_extraction")
    response = response + new_response
    if_complete = check_if_toc_transformation_is_complete(content, response, model, logger=logger)

    attempt = 0
    max_attempts = 5

    while not (if_complete == "yes" and finish_reason == "finished"):
        attempt += 1
        if attempt > max_attempts:
            raise Exception('Failed to complete table of contents after maximum retries')

        chat_history = [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": response},
        ]
        prompt = f"""please continue the generation of table of contents , directly output the remaining part of the structure"""
        print("======================== extract_toc_content llm call ========================")
        new_response, finish_reason = llm_completion(model=model, prompt=prompt, chat_history=chat_history, return_finish_reason=True, logger=logger, operation="toc_content_extraction")
        response = response + new_response
        if_complete = check_if_toc_transformation_is_complete(content, response, model, logger=logger)

    return response

def detect_page_index(toc_content, model=None, logger=None):
    print('start detect_page_index')
    prompt = f"""
    You will be given a table of contents.

    Your job is to detect if there are page numbers/indices given within the table of contents.

    Given text: {toc_content}

    Reply format:
    {{
        "thinking": <why do you think there are page numbers/indices given within the table of contents>
        "page_index_given_in_toc": "<yes or no>"
    }}
    {response_strict_rule}
    """

    print("======================== detect_page_index llm call ========================")
    response = llm_completion(model=model, prompt=prompt, logger=logger, operation="page_index_detection")
    json_content = extract_json(response)
    return json_content['page_index_given_in_toc']

def toc_extractor(page_list, toc_page_list, model, logger=None):
    def transform_dots_to_colon(text):
        text = re.sub(r'\.{5,}', ': ', text)
        # Handle dots separated by spaces
        text = re.sub(r'(?:\. ){5,}\.?', ': ', text)
        return text

    toc_content = ""
    for page_index in toc_page_list:
        toc_content += page_list[page_index][0]
    toc_content = transform_dots_to_colon(toc_content)
    has_page_index = detect_page_index(toc_content, model=model, logger=logger)

    return {
        "toc_content": toc_content,
        "page_index_given_in_toc": has_page_index
    }




def toc_index_extractor(toc, content, model=None, logger=None):
    print('start toc_index_extractor')
    toc_extractor_prompt = """
    You are given a table of contents in a json format and several pages of a document, your job is to add the physical_index to the table of contents in the json format.

    The provided pages contains tags like <physical_index_X> and <physical_index_X> to indicate the physical location of the page X.

    The structure variable is the numeric system which represents the index of the hierarchy section in the table of contents. For example, the first section has structure index 1, the first subsection has structure index 1.1, the second subsection has structure index 1.2, etc.

    The response should be in the following JSON format:
    [
        {
            "structure": <structure index, "x.x.x" or None> (string),
            "title": <title of the section>,
            "physical_index": "<physical_index_X>" (keep the format)
        },
        ...
    ]

    Only add the physical_index to the sections that are in the provided pages.
    If the section is not in the provided pages, do not add the physical_index to it.
    
    Directly return the final JSON structure. Do not output anything else.

    Respond with only the raw JSON object. Do not include markdown code blocks (no ```json tags), do not include introductory text, and do not include concluding remarks. Ensure the JSON is strictly valid.
    """

    prompt = toc_extractor_prompt + '\nTable of contents:\n' + str(toc) + '\nDocument pages:\n' + content
    print("======================== toc_index_extractor llm call ========================")
    response = llm_completion(model=model, prompt=prompt, logger=logger, operation="toc_index_extraction")
    json_content = extract_json(response)
    return json_content



def _split_toc_into_chunks(toc_content, max_chars=5000):
    lines = [line for line in toc_content.splitlines() if line.strip()]
    if not lines:
        return [toc_content]

    chunks = []
    current_lines = []
    current_len = 0
    for line in lines:
        line_len = len(line) + 1
        if current_lines and current_len + line_len > max_chars:
            chunks.append('\n'.join(current_lines))
            current_lines = [line]
            current_len = line_len
        else:
            current_lines.append(line)
            current_len += line_len
    if current_lines:
        chunks.append('\n'.join(current_lines))
    return chunks


def _merge_toc_entries(entry_groups):
    seen = set()
    merged = []
    for entries in entry_groups:
        for item in entries or []:
            key = (
                str(item.get('structure')),
                normalize_for_title_match(item.get('title')),
                item.get('page'),
            )
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)
    return merged


def _infer_toc_structure(title, section_suffix=None):
    if section_suffix and re.match(r'^[\d.]+$', str(section_suffix).strip()):
        return str(section_suffix).strip()
    chapter_match = re.match(r'^chapter\s+(\d+)\b', title or '', re.IGNORECASE)
    if chapter_match:
        return chapter_match.group(1)
    return None


def parse_toc_content_heuristic(toc_content):
    """Rule-based TOC parser for colon/dot-separated contents pages."""
    entries = []
    for raw_line in toc_content.splitlines():
        line = raw_line.strip()
        if not line or line.lower() in {'contents', 'table of contents', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx', 'xxi', 'xxii', 'xxiii', 'xxiv', 'xxv', 'xxvi'}:
            continue

        page = None
        title = None
        structure = None

        parsed = False
        if ':' in line:
            left, _, suffix = line.rpartition(':')
            left = left.strip()
            suffix = suffix.strip()
            left_match = re.match(
                r'^((?:[ivxlcdm]+|\d+))\s+(.+)$',
                left,
                re.IGNORECASE,
            )
            if left_match:
                page = parse_toc_page_number(left_match.group(1))
                title = left_match.group(2).strip().rstrip('.')
                structure = _infer_toc_structure(title, suffix)
                parsed = True

        if not parsed:
            chapter_page_match = re.match(
                r'^(chapter\s+\d+:\s*.+?)\s+(\d{1,4})\s*$',
                line,
                re.IGNORECASE,
            )
            if chapter_page_match:
                title = chapter_page_match.group(1).strip()
                page = int(chapter_page_match.group(2))
                structure = _infer_toc_structure(title)
                parsed = True
            else:
                dotted_match = re.match(
                    r'^((?:[ivxlcdm]+|\d+))\s+(.+?)(?:\s*\.{2,}\s*([\d.]+))?\s*$',
                    line,
                    re.IGNORECASE,
                )
                if dotted_match:
                    page = parse_toc_page_number(dotted_match.group(1))
                    title = dotted_match.group(2).strip().rstrip('.')
                    structure = _infer_toc_structure(title, dotted_match.group(3))
                    parsed = True

        if not parsed or not title:
            continue

        entries.append({
            'structure': str(structure) if structure else None,
            'title': title,
            'page': page,
        })

    return convert_page_to_int(entries)


def _toc_transformer_single(toc_content, model=None, logger=None, max_attempts=5):
    init_prompt = """
    You are given a table of contents, You job is to transform the whole table of content into a JSON format included table_of_contents.

    structure is the numeric system which represents the index of the hierarchy section in the table of contents. For example, the first section has structure index 1, the first subsection has structure index 1.1, the second subsection has structure index 1.2, etc.

    The response should be in the following JSON format:
    {
    table_of_contents: [
        {
            "structure": <structure index, "x.x.x" or None> (string),
            "title": <title of the section>,
            "page": <page number or None>,
        },
        ...
        ],
    }
    You should transform the full table of contents in one go.
    
    Directly return the final JSON structure. Do not output anything else.

    Respond with only the raw JSON object. Do not include markdown code blocks (no ```json tags), do not include introductory text, and do not include concluding remarks. Ensure the JSON is strictly valid.
    """

    prompt = init_prompt + '\n Given table of contents\n:' + toc_content
    print("======================== toc_transformer llm call ========================")
    last_complete, finish_reason = llm_completion(
        model=model,
        prompt=prompt,
        return_finish_reason=True,
        logger=logger,
        operation="toc_transformation",
    )
    if_complete = check_if_toc_transformation_is_complete(toc_content, last_complete, model, logger=logger)
    if if_complete == "yes" and finish_reason == "finished":
        parsed = extract_json(last_complete)
        if parsed.get('table_of_contents'):
            return convert_page_to_int(parsed['table_of_contents'])

    last_complete = get_json_content(last_complete)
    attempt = 0
    while not (if_complete == "yes" and finish_reason == "finished"):
        attempt += 1
        if attempt > max_attempts:
            raise Exception('Failed to complete toc transformation after maximum retries')

        position = last_complete.rfind('}')
        if position != -1:
            last_complete = last_complete[:position + 2]

        prompt = f"""
        Your task is to continue the table of contents json structure, directly output the remaining part of the json structure.
        The response should be in the following JSON format:

        The raw table of contents json structure is:
        {toc_content}

        The incomplete transformed table of contents json structure is:
        {last_complete}

        Please continue the json structure, directly output the remaining part of the json structure."""

        print("======================== toc_transformer llm call To finish the json structure ========================")
        new_complete, finish_reason = llm_completion(
            model=model,
            prompt=prompt,
            return_finish_reason=True,
            logger=logger,
            operation="toc_transformation",
        )

        if new_complete.startswith('```json'):
            new_complete = get_json_content(new_complete)
        last_complete = last_complete + new_complete

        if_complete = check_if_toc_transformation_is_complete(toc_content, last_complete, model, logger=logger)

    parsed = extract_json(last_complete)
    return convert_page_to_int(parsed['table_of_contents'])


def _toc_transformer_chunked(toc_content, model=None, logger=None):
    chunks = _split_toc_into_chunks(toc_content)
    chunk_results = []
    for chunk in chunks:
        try:
            chunk_results.append(_toc_transformer_single(chunk, model=model, logger=logger, max_attempts=3))
        except Exception as exc:
            print(f"Chunked toc_transformer failed for chunk: {exc}")
            heuristic_chunk = parse_toc_content_heuristic(chunk)
            if heuristic_chunk:
                chunk_results.append(heuristic_chunk)
    merged = _merge_toc_entries(chunk_results)
    if merged:
        return merged
    raise Exception('Failed to complete chunked toc transformation')


def toc_transformer(toc_content, model=None, logger=None):
    print('start toc_transformer')
    heuristic_entries = parse_toc_content_heuristic(toc_content)
    line_count = len([line for line in toc_content.splitlines() if line.strip()])

    if line_count > 80 or len(toc_content) > 6000:
        if heuristic_entries and len(heuristic_entries) >= max(10, line_count // 4):
            if logger:
                logger.info({
                    'step': 'toc_transformer_heuristic',
                    'entries': len(heuristic_entries),
                    'line_count': line_count,
                })
            print(f"Using heuristic TOC parser ({len(heuristic_entries)} entries)")
            return heuristic_entries

        try:
            result = _toc_transformer_chunked(toc_content, model=model, logger=logger)
            if logger:
                logger.info({'step': 'toc_transformer_chunked', 'entries': len(result)})
            return result
        except Exception as exc:
            print(f"Chunked toc_transformer failed, falling back to heuristic: {exc}")
            if heuristic_entries:
                return heuristic_entries
            raise

    try:
        return _toc_transformer_single(toc_content, model=model, logger=logger)
    except Exception as exc:
        print(f"Single-shot toc_transformer failed, falling back to heuristic: {exc}")
        if heuristic_entries:
            if logger:
                logger.info({
                    'step': 'toc_transformer_heuristic_fallback',
                    'entries': len(heuristic_entries),
                })
            return heuristic_entries
        raise




def find_toc_pages(start_page_index, page_list, opt, logger=None):
    print('start find_toc_pages')
    last_page_is_yes = False
    toc_page_list = []
    consecutive_non_toc = 0
    i = start_page_index

    while i < len(page_list):
        print(f'i: {i}')
        if i >= opt.toc_check_page_num and not last_page_is_yes:
            break

        is_candidate = looks_like_toc_candidate(page_list[i][0])
        if not is_candidate and last_page_is_yes:
            is_candidate = looks_like_toc_continuation(page_list[i][0])

        if not is_candidate:
            if last_page_is_yes:
                consecutive_non_toc += 1
                if consecutive_non_toc >= 2:
                    if logger:
                        logger.info(f'Found the last page with toc: {i - consecutive_non_toc}')
                    break
            i += 1
            continue

        consecutive_non_toc = 0
        if last_page_is_yes and looks_like_toc_continuation(page_list[i][0]):
            detected_result = 'yes'
        else:
            detected_result = toc_detector_single_page(page_list[i][0], model=opt.model, logger=logger)
        print(f'detected_result: {detected_result}')

        if detected_result == 'yes':
            if logger:
                logger.info(f'Page {i} has toc')
            toc_page_list.append(i)
            last_page_is_yes = True
        elif detected_result == 'no' and last_page_is_yes:
            consecutive_non_toc += 1
            if consecutive_non_toc >= 2:
                if logger:
                    logger.info(f'Found the last page with toc: {i - consecutive_non_toc}')
                break
        i += 1

    if not toc_page_list and logger:
        logger.info('No toc found')

    return toc_page_list

def remove_page_number(data):
    if isinstance(data, dict):
        data.pop('page_number', None)
        for key in list(data.keys()):
            if 'nodes' in key:
                remove_page_number(data[key])
    elif isinstance(data, list):
        for item in data:
            remove_page_number(item)
    return data

def extract_matching_page_pairs(toc_page, toc_physical_index, start_page_index):
    pairs = []
    for phy_item in toc_physical_index:
        phy_title = normalize_for_title_match(phy_item.get('title'))
        for page_item in toc_page:
            page_title = normalize_for_title_match(page_item.get('title'))
            titles_match = (
                phy_item.get('title') == page_item.get('title')
                or (phy_title and phy_title == page_title)
                or (phy_title and page_title and (phy_title in page_title or page_title in phy_title))
            )
            if not titles_match:
                continue
            physical_index = phy_item.get('physical_index')
            try:
                physical_index = int(physical_index)
            except (TypeError, ValueError):
                continue

            page_number = parse_toc_page_number(page_item.get('page'))
            if page_number is None:
                continue

            if physical_index >= start_page_index:
                pairs.append({
                    'title': phy_item.get('title'),
                    'page': page_number,
                    'physical_index': physical_index
                })
    return pairs


def calculate_page_offset(pairs):
    differences = []
    for pair in pairs:
        try:
            physical_index = pair['physical_index']
            page_number = pair['page']
            difference = physical_index - page_number
            differences.append(difference)
        except (KeyError, TypeError):
            continue

    if not differences:
        return None

    difference_counts = {}
    for diff in differences:
        difference_counts[diff] = difference_counts.get(diff, 0) + 1

    most_common = max(difference_counts.items(), key=lambda x: x[1])[0]

    return most_common

def add_page_offset_to_toc_json(data, offset):
    if offset is None:
        return data

    for i in range(len(data)):
        page_number = parse_toc_page_number(data[i].get('page'))
        if page_number is not None:
            data[i]['physical_index'] = page_number + offset
            data[i].pop('page', None)

    return data



def page_list_to_group_text(page_contents, token_lengths, max_tokens=20000, overlap_page=1):
    num_tokens = sum(token_lengths)

    if num_tokens <= max_tokens:
        # merge all pages into one text
        page_text = "".join(page_contents)
        return [page_text]

    subsets = []
    current_subset = []
    current_token_count = 0

    expected_parts_num = math.ceil(num_tokens / max_tokens)
    average_tokens_per_part = math.ceil(((num_tokens / expected_parts_num) + max_tokens) / 2)

    for i, (page_content, page_tokens) in enumerate(zip(page_contents, token_lengths)):
        if current_token_count + page_tokens > average_tokens_per_part:

            subsets.append(''.join(current_subset))
            # Start new subset from overlap if specified
            overlap_start = max(i - overlap_page, 0)
            current_subset = page_contents[overlap_start:i]
            current_token_count = sum(token_lengths[overlap_start:i])

        # Add current page to the subset
        current_subset.append(page_content)
        current_token_count += page_tokens

    # Add the last subset if it contains any pages
    if current_subset:
        subsets.append(''.join(current_subset))

    print('divide page_list to groups', len(subsets))
    return subsets

def add_page_number_to_toc(part, structure, model=None, logger=None):
    fill_prompt_seq = """
    You are given an JSON structure of a document and a partial part of the document. Your task is to check if the title that is described in the structure is started in the partial given document.

    The provided text contains tags like <physical_index_X> and <physical_index_X> to indicate the physical location of the page X.

    If the full target section starts in the partial given document, insert the given JSON structure with the "start": "yes", and "start_index": "<physical_index_X>".

    If the full target section does not start in the partial given document, insert "start": "no",  "start_index": None.

    The response should be in the following format.
        [
            {
                "structure": <structure index, "x.x.x" or None> (string),
                "title": <title of the section>,
                "start": "<yes or no>",
                "physical_index": "<physical_index_X> (keep the format)" or None
            },
            ...
        ]
    The given structure contains the result of the previous part, you need to fill the result of the current part, do not change the previous result.
    Directly return the final JSON structure. Do not output anything else.

    Respond with only the raw JSON object. Do not include markdown code blocks (no ```json tags), do not include introductory text, and do not include concluding remarks. Ensure the JSON is strictly valid.
    """

    prompt = fill_prompt_seq + f"\n\nCurrent Partial Document:\n{part}\n\nGiven Structure\n{json.dumps(structure, indent=2)}\n"
    print("======================== add_page_number_to_toc llm call ========================")
    current_json_raw = llm_completion(model=model, prompt=prompt, logger=logger, operation="page_number_assignment")
    json_result = extract_json(current_json_raw)

    for item in json_result:
        if 'start' in item:
            del item['start']
    return json_result


def remove_first_physical_index_section(text):
    """
    Removes the first section between <physical_index_X> and <physical_index_X> tags,
    and returns the remaining text.
    """
    pattern = r'<physical_index_\d+>.*?<physical_index_\d+>'
    match = re.search(pattern, text, re.DOTALL)
    if match:
        # Remove the first matched section
        return text.replace(match.group(0), '', 1)
    return text

### add verify completeness
def generate_toc_continue(toc_content, part, model=None, logger=None):
    print('start generate_toc_continue')
    prompt = """
    You are an expert in extracting hierarchical tree structure.
    You are given a tree structure of the previous part and the text of the current part.
    Your task is to continue the tree structure from the previous part to include the current part.

    The structure variable is the numeric system which represents the index of the hierarchy section in the table of contents. For example, the first section has structure index 1, the first subsection has structure index 1.1, the second subsection has structure index 1.2, etc.

    For the title, you need to extract the original title from the text, only fix the space inconsistency.

    The provided text contains tags like <physical_index_X> and <physical_index_X> to indicate the start and end of page X. \

    For the physical_index, you need to extract the physical index of the start of the section from the text. Keep the <physical_index_X> format.
    The physical_index must come ONLY from <physical_index_X> tags in the text, never from in-text page references or page numbers mentioned in the body.
    Each section should have a distinct start page when possible.
    Do not assign index, glossary, or appendix pages unless the section title clearly belongs there.

    """
    response_prompt = """
    The response should be in the following format.
        [
            {
                "structure": <structure index, "x.x.x"> (string),
                "title": <title of the section, keep the original title>,
                "physical_index": "<physical_index_X> (keep the format)"
            },
            ...
        ]

    Directly return the final JSON structure. Do not output anything else.

    Respond with only the raw JSON object. Do not include markdown code blocks (no ```json tags), do not include introductory text, and do not include concluding remarks. Ensure the JSON is strictly valid.
    """


    prompt = prompt + '\nGiven text\n=================================================' + part + '\n=================================================\n Previous tree structure\n=================================================' + json.dumps(toc_content, indent=2) + '\n=================================================\n\n' + response_prompt
    print("======================== generate_toc_continue llm call ========================")
    response, finish_reason = llm_completion(model=model, prompt=prompt, return_finish_reason=True, logger=logger, operation="toc_structure_continuation")
    if finish_reason == 'finished':
        return extract_json(response)
    else:
        raise Exception(f'finish reason: {finish_reason}')

### add verify completeness
def generate_toc_init(part, model=None, logger=None):
    print('start generate_toc_init')
    prompt = """
    You are an expert in extracting hierarchical tree structure, your task is to generate the tree structure of the document.

    The structure variable is the numeric system which represents the index of the hierarchy section in the table of contents. For example, the first section has structure index 1, the first subsection has structure index 1.1, the second subsection has structure index 1.2, etc.

    For the title, you need to extract the original title from the text, only fix the space inconsistency.

    The provided text contains tags like <physical_index_X> and <physical_index_X> to indicate the start and end of page X.

    For the physical_index, you need to extract the physical index of the start of the section from the text. Keep the <physical_index_X> format.
    The physical_index must come ONLY from <physical_index_X> tags in the text, never from in-text page references or page numbers mentioned in the body.
    Each section should have a distinct start page when possible.
    Do not assign index, glossary, or appendix pages unless the section title clearly belongs there.

    """

    response_prompt = """
    The response should be in the following format.
        [
            {{
                "structure": <structure index, "x.x.x"> (string),
                "title": <title of the section, keep the original title>,
                "physical_index": "<physical_index_X> (keep the format)"
            }},

        ],


    Directly return the final JSON structure. Do not output anything else.

    Respond with only the raw JSON object. Do not include markdown code blocks (no ```json tags), do not include introductory text, and do not include concluding remarks. Ensure the JSON is strictly valid.
    """

    prompt = prompt + '\nGiven text\n=================================================' + part + '\n=================================================\n\n' + response_prompt
    print("======================== generate_toc_init llm call ========================")
    response, finish_reason = llm_completion(model=model, prompt=prompt, return_finish_reason=True, logger=logger, operation="toc_structure_generation")
    if finish_reason == 'finished':
         return extract_json(response)
    else:
        raise Exception(f'finish reason: {finish_reason}')

def process_no_toc(page_list, start_index=1, model=None, logger=None, max_tokens_per_group=8000):
    if logger:
        logger.info({"step": "process_no_toc", "message": "No TOC found — inferring structure from content"})
    page_contents=[]
    token_lengths=[]
    for page_index in range(start_index, start_index+len(page_list)):
        page_text = f"<physical_index_{page_index}>\n{page_list[page_index-start_index][0]}\n<physical_index_{page_index}>\n\n"
        page_contents.append(page_text)
        token_lengths.append(count_tokens(page_text, model))
    group_texts = page_list_to_group_text(page_contents, token_lengths, max_tokens=max_tokens_per_group)
    logger.info(f'len(group_texts): {len(group_texts)}')

    toc_with_page_number= generate_toc_init(group_texts[0], model, logger=logger)
    for group_text in group_texts[1:]:
        toc_with_page_number_additional = generate_toc_continue(toc_with_page_number, group_text, model, logger=logger)
        toc_with_page_number.extend(toc_with_page_number_additional)
    logger.info(f'generate_toc: {toc_with_page_number}')

    toc_with_page_number = convert_physical_index_to_int(toc_with_page_number)
    logger.info(f'convert_physical_index_to_int: {toc_with_page_number}')

    return toc_with_page_number

def process_toc_no_page_numbers(toc_content, toc_page_list, page_list, start_index=1, model=None, logger=None, max_tokens_per_group=8000):
    if logger:
        logger.info({"step": "process_toc_no_page_numbers", "message": "TOC found but no page numbers — resolving page indices"})
    page_contents=[]
    token_lengths=[]
    toc_content = toc_transformer(toc_content, model, logger=logger)
    logger.info(f'toc_transformer: {toc_content}')
    for page_index in range(start_index, start_index+len(page_list)):
        page_text = f"<physical_index_{page_index}>\n{page_list[page_index-start_index][0]}\n<physical_index_{page_index}>\n\n"
        page_contents.append(page_text)
        token_lengths.append(count_tokens(page_text, model))

    group_texts = page_list_to_group_text(page_contents, token_lengths, max_tokens=max_tokens_per_group)
    logger.info(f'len(group_texts): {len(group_texts)}')

    toc_with_page_number=copy.deepcopy(toc_content)
    for group_text in group_texts:
        toc_with_page_number = add_page_number_to_toc(group_text, toc_with_page_number, model, logger=logger)
    logger.info(f'add_page_number_to_toc: {toc_with_page_number}')

    toc_with_page_number = convert_physical_index_to_int(toc_with_page_number)
    logger.info(f'convert_physical_index_to_int: {toc_with_page_number}')

    return toc_with_page_number



def process_toc_with_page_numbers(toc_content, toc_page_list, page_list, toc_check_page_num=None, model=None, logger=None):
    if logger:
        logger.info({"step": "process_toc_with_page_numbers", "message": "TOC with page numbers found — mapping to physical indices"})
    toc_with_page_number = toc_transformer(toc_content, model, logger=logger)
    logger.info(f'toc_with_page_number: {toc_with_page_number}')

    toc_no_page_number = remove_page_number(copy.deepcopy(toc_with_page_number))

    start_page_index = toc_page_list[-1] + 1
    scan_pages = max(toc_check_page_num or 20, 30)
    main_content = ""
    for page_index in range(start_page_index, min(start_page_index + scan_pages, len(page_list))):
        main_content += f"<physical_index_{page_index+1}>\n{page_list[page_index][0]}\n<physical_index_{page_index+1}>\n\n"

    toc_with_physical_index = toc_index_extractor(toc_no_page_number, main_content, model, logger=logger)
    logger.info(f'toc_with_physical_index: {toc_with_physical_index}')

    toc_with_physical_index = convert_physical_index_to_int(toc_with_physical_index)
    logger.info(f'toc_with_physical_index: {toc_with_physical_index}')

    matching_pairs = extract_matching_page_pairs(toc_with_page_number, toc_with_physical_index, start_page_index)
    logger.info(f'matching_pairs: {matching_pairs}')

    offset = calculate_page_offset(matching_pairs)
    logger.info(f'offset: {offset}')

    if offset is None:
        if logger:
            logger.info({
                "step": "process_toc_with_page_numbers",
                "message": "Could not derive page offset from TOC matches; falling back to physical-index extraction"
            })
        return toc_with_page_number

    toc_with_page_number = add_page_offset_to_toc_json(toc_with_page_number, offset)
    logger.info(f'toc_with_page_number: {toc_with_page_number}')

    toc_with_page_number = process_none_page_numbers(toc_with_page_number, page_list, model=model, logger=logger)
    logger.info(f'toc_with_page_number: {toc_with_page_number}')

    return toc_with_page_number



##check if needed to process none page numbers
def process_none_page_numbers(toc_items, page_list, start_index=1, model=None, logger=None):
    for i, item in enumerate(toc_items):
        if "physical_index" not in item:
            # Find previous physical_index
            prev_physical_index = 0  # Default if no previous item exists
            for j in range(i - 1, -1, -1):
                if toc_items[j].get('physical_index') is not None:
                    prev_physical_index = toc_items[j]['physical_index']
                    break

            # Find next physical_index
            next_physical_index = -1  # Default if no next item exists
            for j in range(i + 1, len(toc_items)):
                if toc_items[j].get('physical_index') is not None:
                    next_physical_index = toc_items[j]['physical_index']
                    break

            page_contents = []
            for page_index in range(prev_physical_index, next_physical_index+1):
                # Add bounds checking to prevent IndexError
                list_index = page_index - start_index
                if list_index >= 0 and list_index < len(page_list):
                    page_text = f"<physical_index_{page_index}>\n{page_list[list_index][0]}\n<physical_index_{page_index}>\n\n"
                    page_contents.append(page_text)
                else:
                    continue

            item_copy = copy.deepcopy(item)
            del item_copy['page']
            result = add_page_number_to_toc(page_contents, item_copy, model, logger=logger)
            if isinstance(result[0]['physical_index'], str) and result[0]['physical_index'].startswith('<physical_index'):
                item['physical_index'] = int(result[0]['physical_index'].split('_')[-1].rstrip('>').strip())
                del item['page']

    return toc_items




def check_toc(page_list, opt=None, logger=None):
    if logger:
        logger.info({"step": "check_toc", "message": "Scanning for table of contents"})
    toc_page_list = find_toc_pages(start_page_index=0, page_list=page_list, opt=opt, logger=logger)
    print("toc_page_list =>", toc_page_list)
    if len(toc_page_list) == 0:
        print('no toc found')
        return {'toc_content': None, 'toc_page_list': [], 'page_index_given_in_toc': 'no'}
    else:
        print('toc found')
        toc_json = toc_extractor(page_list, toc_page_list, opt.model, logger=logger)

        if toc_json['page_index_given_in_toc'] == 'yes':
            print('index found')
            return {'toc_content': toc_json['toc_content'], 'toc_page_list': toc_page_list, 'page_index_given_in_toc': 'yes'}
        else:
            current_start_index = toc_page_list[-1] + 1

            while (toc_json['page_index_given_in_toc'] == 'no' and
                   current_start_index < len(page_list) and
                   current_start_index < opt.toc_check_page_num):

                additional_toc_pages = find_toc_pages(
                    start_page_index=current_start_index,
                    page_list=page_list,
                    opt=opt,
                    logger=logger,
                )

                if len(additional_toc_pages) == 0:
                    break

                additional_toc_json = toc_extractor(page_list, additional_toc_pages, opt.model, logger=logger)
                if additional_toc_json['page_index_given_in_toc'] == 'yes':
                    print('index found')
                    return {'toc_content': additional_toc_json['toc_content'], 'toc_page_list': additional_toc_pages, 'page_index_given_in_toc': 'yes'}

                else:
                    current_start_index = additional_toc_pages[-1] + 1
            print('index not found')
            return {'toc_content': toc_json['toc_content'], 'toc_page_list': toc_page_list, 'page_index_given_in_toc': 'no'}




################### fix incorrect toc #########################################################
async def single_toc_item_index_fixer(section_title, content, model=None, logger=None):
    toc_extractor_prompt = """
    You are given a section title and several pages of a document, your job is to find the physical index of the start page of the section in the partial document.

    The provided pages contains tags like <physical_index_X> and <physical_index_X> to indicate the physical location of the page X.

    Reply in a JSON format:
    {
        "thinking": <explain which page, started and closed by <physical_index_X>, contains the start of this section>,
        "physical_index": "<physical_index_X>" (keep the format)
    }
    
    Directly return the final JSON structure. Do not output anything else.

    Respond with only the raw JSON object. Do not include markdown code blocks (no ```json tags), do not include introductory text, and do not include concluding remarks. Ensure the JSON is strictly valid.
    """

    prompt = toc_extractor_prompt + '\nSection Title:\n' + str(section_title) + '\nDocument pages:\n' + content
    print("======================== single_toc_item_index_fixer llm call ========================")
    response = await llm_acompletion(model=model, prompt=prompt, logger=logger, operation="toc_item_index_fix")
    json_content = extract_json(response)
    return convert_physical_index_to_int(json_content['physical_index'])



async def fix_incorrect_toc(toc_with_page_number, page_list, incorrect_results, start_index=1, model=None, logger=None):
    print(f'start fix_incorrect_toc with {len(incorrect_results)} incorrect results')
    if logger:
        logger.info({"step": "fix_incorrect_toc", "message": f"Fixing {len(incorrect_results)} incorrect TOC entries"})
    incorrect_indices = {result['list_index'] for result in incorrect_results}

    end_index = len(page_list) + start_index - 1

    incorrect_results_and_range_logs = []
    # Helper function to process and check a single incorrect item
    async def process_and_check_item(incorrect_item):
        list_index = incorrect_item['list_index']

        # Check if list_index is valid
        if list_index < 0 or list_index >= len(toc_with_page_number):
            # Return an invalid result for out-of-bounds indices
            return {
                'list_index': list_index,
                'title': incorrect_item['title'],
                'physical_index': incorrect_item.get('physical_index'),
                'is_valid': False
            }

        # Find the previous correct item
        prev_correct = None
        for i in range(list_index-1, -1, -1):
            if i not in incorrect_indices and i >= 0 and i < len(toc_with_page_number):
                physical_index = toc_with_page_number[i].get('physical_index')
                if physical_index is not None:
                    prev_correct = physical_index
                    break
        # If no previous correct item found, use start_index
        if prev_correct is None:
            prev_correct = start_index - 1

        # Find the next correct item
        next_correct = None
        for i in range(list_index+1, len(toc_with_page_number)):
            if i not in incorrect_indices and i >= 0 and i < len(toc_with_page_number):
                physical_index = toc_with_page_number[i].get('physical_index')
                if physical_index is not None:
                    next_correct = physical_index
                    break
        # If no next correct item found, use end_index
        if next_correct is None:
            next_correct = end_index

        incorrect_results_and_range_logs.append({
            'list_index': list_index,
            'title': incorrect_item['title'],
            'prev_correct': prev_correct,
            'next_correct': next_correct
        })

        page_contents=[]
        for page_index in range(prev_correct, next_correct+1):
            # Add bounds checking to prevent IndexError
            page_list_idx = page_index - start_index
            if page_list_idx >= 0 and page_list_idx < len(page_list):
                page_text = f"<physical_index_{page_index}>\n{page_list[page_list_idx][0]}\n<physical_index_{page_index}>\n\n"
                page_contents.append(page_text)
            else:
                continue
        content_range = ''.join(page_contents)

        physical_index_int = await single_toc_item_index_fixer(incorrect_item['title'], content_range, model, logger=logger)

        # Check if the result is correct
        check_item = incorrect_item.copy()
        check_item['physical_index'] = physical_index_int
        check_result = await check_title_appearance(check_item, page_list, start_index, model, logger=logger)

        return {
            'list_index': list_index,
            'title': incorrect_item['title'],
            'physical_index': physical_index_int,
            'is_valid': check_result['answer'] == 'yes'
        }

    # Process incorrect items concurrently
    tasks = [
        process_and_check_item(item)
        for item in incorrect_results
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for item, result in zip(incorrect_results, results):
        if isinstance(result, Exception):
            print(f"Processing item {item} generated an exception: {result}")
            continue
    results = [result for result in results if not isinstance(result, Exception)]

    # Update the toc_with_page_number with the fixed indices and check for any invalid results
    invalid_results = []
    for result in results:
        if result['is_valid']:
            # Add bounds checking to prevent IndexError
            list_idx = result['list_index']
            if 0 <= list_idx < len(toc_with_page_number):
                toc_with_page_number[list_idx]['physical_index'] = result['physical_index']
            else:
                # Index is out of bounds, treat as invalid
                invalid_results.append({
                    'list_index': result['list_index'],
                    'title': result['title'],
                    'physical_index': result['physical_index'],
                })
        else:
            invalid_results.append({
                'list_index': result['list_index'],
                'title': result['title'],
                'physical_index': result['physical_index'],
            })

    logger.info(f'incorrect_results_and_range_logs: {incorrect_results_and_range_logs}')
    logger.info(f'invalid_results: {invalid_results}')

    return toc_with_page_number, invalid_results



async def fix_incorrect_toc_with_retries(toc_with_page_number, page_list, incorrect_results, start_index=1, max_attempts=3, model=None, logger=None):
    print('start fix_incorrect_toc')
    fix_attempt = 0
    current_toc = toc_with_page_number
    current_incorrect = incorrect_results

    while current_incorrect:
        print(f"Fixing {len(current_incorrect)} incorrect results")

        current_toc, current_incorrect = await fix_incorrect_toc(current_toc, page_list, current_incorrect, start_index, model, logger)

        fix_attempt += 1
        if fix_attempt >= max_attempts:
            logger.info("Maximum fix attempts reached")
            break

    return current_toc, current_incorrect




################### verify toc #########################################################
async def verify_toc(page_list, list_result, start_index=1, N=None, model=None, logger=None):
    print('start verify_toc')
    if logger:
        logger.info({"step": "verify_toc", "message": "Verifying TOC accuracy"})
    max_llm_checks_per_page = 3
    max_total_llm_checks = 12
    llm_concurrency = 2

    # Find the last non-None physical_index
    last_physical_index = None
    for item in reversed(list_result):
        if item.get('physical_index') is not None:
            last_physical_index = item['physical_index']
            break

    # Early return if we don't have valid physical indices
    if last_physical_index is None or last_physical_index < len(page_list)/2:
        return 0, []

    # Determine which items to check
    if N is None:
        print('check all items')
        sample_indices = range(0, len(list_result))
    else:
        N = min(N, len(list_result))
        print(f'check {N} items')
        sample_indices = random.sample(range(0, len(list_result)), N)

    # Prepare items with their list indices
    indexed_sample_list = []
    seen_sample_keys = set()
    for idx in sample_indices:
        item = list_result[idx]
        # Skip items with None physical_index (these were invalidated by validate_and_truncate_physical_indices)
        if item.get('physical_index') is not None:
            sample_key = toc_item_identity(item)
            if sample_key in seen_sample_keys:
                continue
            seen_sample_keys.add(sample_key)

            item_with_index = item.copy()
            item_with_index['list_index'] = idx  # Add the original index in list_result
            indexed_sample_list.append(item_with_index)

    results = []
    llm_check_items = []
    llm_check_count_by_page = {}
    skipped_llm_count = 0
    for item in indexed_sample_list:
        page_number = item.get('physical_index')
        page_list_index = page_number - start_index
        if page_list_index < 0 or page_list_index >= len(page_list):
            results.append({
                'list_index': item['list_index'],
                'answer': 'no',
                'title': item['title'],
                'page_number': page_number,
            })
            continue

        page_text = page_list[page_list_index][0]
        if title_appears_in_page(item['title'], page_text):
            results.append({
                'list_index': item['list_index'],
                'answer': 'yes',
                'title': item['title'],
                'page_number': page_number,
            })
        else:
            checks_for_page = llm_check_count_by_page.get(page_number, 0)
            if len(llm_check_items) < max_total_llm_checks and checks_for_page < max_llm_checks_per_page:
                llm_check_count_by_page[page_number] = checks_for_page + 1
                llm_check_items.append(item)
            else:
                skipped_llm_count += 1
                results.append({
                    'list_index': item['list_index'],
                    'answer': 'no',
                    'title': item['title'],
                    'page_number': page_number,
                })

    if llm_check_items:
        print("======================== verify_toc llm call ========================")
        print("indexed_sample_list =>", llm_check_items)
        if logger:
            logger.info({
                "step": "verify_toc_llm_checks",
                "checking": len(llm_check_items),
                "max_per_page": max_llm_checks_per_page,
                "max_total": max_total_llm_checks,
                "skipped": skipped_llm_count,
            })

        # Run only a bounded set of ambiguous checks concurrently.
        tasks = [
            check_title_appearance(item, page_list, start_index, model, logger=logger)
            for item in llm_check_items
        ]
        results.extend(await gather_with_limit(tasks, llm_concurrency))

    # Process results
    correct_count = 0
    incorrect_results = []
    for result in results:
        if result['answer'] == 'yes':
            correct_count += 1
        else:
            incorrect_results.append(result)

    # Calculate accuracy
    checked_count = len(results)
    accuracy = correct_count / checked_count if checked_count > 0 else 0
    print(f"accuracy: {accuracy*100:.2f}%")
    if logger:
        logger.info({"step": "verify_toc_result", "accuracy": accuracy, "checked": checked_count, "incorrect": len(incorrect_results)})
    return accuracy, incorrect_results




################### main process #########################################################
def _build_toc_from_mode(page_list, mode, toc_content, toc_page_list, start_index, opt, logger):
    max_tokens_per_group = getattr(opt, 'max_tokens_per_toc_group', 8000)

    if mode == 'process_toc_with_page_numbers':
        return process_toc_with_page_numbers(
            toc_content,
            toc_page_list,
            page_list,
            toc_check_page_num=opt.toc_check_page_num,
            model=opt.model,
            logger=logger,
        )
    if mode == 'process_toc_no_page_numbers':
        return process_toc_no_page_numbers(
            toc_content,
            toc_page_list,
            page_list,
            model=opt.model,
            logger=logger,
            max_tokens_per_group=max_tokens_per_group,
        )
    return process_no_toc(
        page_list,
        start_index=start_index,
        model=opt.model,
        logger=logger,
        max_tokens_per_group=max_tokens_per_group,
    )


def _prepare_toc_for_verification(toc_with_page_number, page_list, start_index, logger):
    toc_with_page_number = deduplicate_toc_items(toc_with_page_number, logger=logger)
    toc_with_page_number = [item for item in toc_with_page_number if item.get('physical_index') is not None]
    toc_with_page_number = validate_and_truncate_physical_indices(
        toc_with_page_number,
        len(page_list),
        start_index=start_index,
        logger=logger,
    )
    return normalize_toc_physical_indices(
        toc_with_page_number,
        page_list,
        start_index=start_index,
        logger=logger,
    )


def _make_toc_verification(accuracy, mode, warning=None):
    return {
        'accuracy': accuracy,
        'mode': mode,
        'warning': warning,
    }


async def meta_processor(page_list, mode=None, toc_content=None, toc_page_list=None, start_index=1, opt=None, logger=None, retry_with_smaller_chunks=False):
    print(mode)
    print(f'start_index: {start_index}')
    if logger:
        logger.info({"step": "meta_processor", "mode": mode, "start_index": start_index, "retry_with_smaller_chunks": retry_with_smaller_chunks})

    if retry_with_smaller_chunks:
        original_max_tokens = getattr(opt, 'max_tokens_per_toc_group', 8000)
        opt.max_tokens_per_toc_group = max(original_max_tokens // 2, 2000)

    try:
        toc_with_page_number = _build_toc_from_mode(
            page_list,
            mode,
            toc_content,
            toc_page_list,
            start_index,
            opt,
            logger,
        )
        toc_with_page_number = _prepare_toc_for_verification(
            toc_with_page_number,
            page_list,
            start_index,
            logger,
        )

        accuracy, incorrect_results = await verify_toc(
            page_list,
            toc_with_page_number,
            start_index=start_index,
            model=opt.model,
            logger=logger,
        )

        logger.info({
            'mode': mode,
            'accuracy': accuracy,
            'incorrect_results': incorrect_results
        })
        print(f"======================== accuracy => {accuracy} ========================")

        if accuracy == 1.0 and len(incorrect_results) == 0:
            return toc_with_page_number, _make_toc_verification(accuracy, mode)

        if incorrect_results:
            toc_with_page_number, incorrect_results = await fix_incorrect_toc_with_retries(
                toc_with_page_number,
                page_list,
                incorrect_results,
                start_index=start_index,
                max_attempts=3,
                model=opt.model,
                logger=logger,
            )
            accuracy, incorrect_results = await verify_toc(
                page_list,
                toc_with_page_number,
                start_index=start_index,
                model=opt.model,
                logger=logger,
            )
            logger.info({
                'mode': mode,
                'accuracy': accuracy,
                'incorrect_results': incorrect_results,
                'step': 'post_fix_verify',
            })
            print(f"======================== post-fix accuracy => {accuracy} ========================")

        if accuracy == 1.0 and len(incorrect_results) == 0:
            return toc_with_page_number, _make_toc_verification(accuracy, mode)

        if mode == 'process_toc_with_page_numbers':
            if logger:
                logger.info({
                    'step': 'meta_processor_fallback',
                    'from_mode': mode,
                    'to_mode': 'process_toc_no_page_numbers',
                    'accuracy': accuracy,
                })
            return await meta_processor(
                page_list,
                mode='process_toc_no_page_numbers',
                toc_content=toc_content,
                toc_page_list=toc_page_list,
                start_index=start_index,
                opt=opt,
                logger=logger,
            )
        if mode == 'process_toc_no_page_numbers':
            if accuracy < 0.3:
                if logger:
                    logger.info({
                        'step': 'meta_processor_fallback',
                        'from_mode': mode,
                        'to_mode': 'process_no_toc',
                        'accuracy': accuracy,
                    })
                return await meta_processor(
                    page_list,
                    mode='process_no_toc',
                    start_index=start_index,
                    opt=opt,
                    logger=logger,
                )
            warning = 'low_confidence' if accuracy < 0.6 else None
            verification = _make_toc_verification(accuracy, mode, warning=warning)
            if warning and logger:
                logger.info({
                    'step': 'toc_verification_warning',
                    'accuracy': accuracy,
                    'mode': mode,
                    'warning': warning,
                    'incorrect_count': len(incorrect_results),
                })
            return toc_with_page_number, verification

        if not retry_with_smaller_chunks:
            return await meta_processor(
                page_list,
                mode='process_no_toc',
                start_index=start_index,
                opt=opt,
                logger=logger,
                retry_with_smaller_chunks=True,
            )

        warning = 'low_confidence' if accuracy < 0.6 else None
        verification = _make_toc_verification(accuracy, mode, warning=warning)
        if warning and logger:
            logger.info({
                'step': 'toc_verification_warning',
                'accuracy': accuracy,
                'mode': mode,
                'warning': warning,
                'incorrect_count': len(incorrect_results),
            })
        return toc_with_page_number, verification
    finally:
        if retry_with_smaller_chunks:
            opt.max_tokens_per_toc_group = original_max_tokens


def _node_in_toc_range(node, toc_page_list, start_index=1):
    if not toc_page_list:
        return False
    start_page = node.get('start_index')
    end_page = node.get('end_index', start_page)
    if start_page is None:
        return False
    toc_start = min(toc_page_list) + start_index
    toc_end = max(toc_page_list) + start_index
    return start_page >= toc_start and end_page <= toc_end


async def process_large_node_recursively(node, page_list, opt=None, logger=None, toc_page_list=None):
    if toc_page_list and _node_in_toc_range(node, toc_page_list):
        if 'nodes' in node and node['nodes']:
            node['nodes'] = dedupe_structure_nodes(node['nodes'], parent_title=node.get('title'))
            for child_node in node['nodes']:
                await process_large_node_recursively(child_node, page_list, opt, logger, toc_page_list)
        return node

    node_page_list = page_list[node['start_index']-1:node['end_index']]
    token_num = sum([page[1] for page in node_page_list])

    if node['end_index'] - node['start_index'] > opt.max_page_num_each_node and token_num >= opt.max_token_num_each_node:
        print('large node:', node['title'], 'start_index:', node['start_index'], 'end_index:', node['end_index'], 'token_num:', token_num)
        if logger:
            logger.info({"step": "process_large_node", "title": node['title'], "start_index": node['start_index'], "end_index": node['end_index'], "token_num": token_num})

        node_toc_tree, node_verification = await meta_processor(
            node_page_list,
            mode='process_no_toc',
            start_index=node['start_index'],
            opt=opt,
            logger=logger,
        )
        if node_verification.get('warning') and logger:
            logger.info({
                'step': 'large_node_toc_verification',
                'title': node['title'],
                **node_verification,
            })
        node_toc_tree = await check_title_appearance_in_start_concurrent(node_toc_tree, page_list, model=opt.model, logger=logger)

        # Filter out items with None physical_index before post_processing
        valid_node_toc_items = [item for item in node_toc_tree if item.get('physical_index') is not None]
        valid_node_toc_items = deduplicate_toc_items(valid_node_toc_items, logger=logger)

        if valid_node_toc_items and node['title'].strip() == valid_node_toc_items[0]['title'].strip():
            node['nodes'] = post_processing(valid_node_toc_items[1:], node['end_index'])
            if len(valid_node_toc_items) > 1:
                node['end_index'] = valid_node_toc_items[1]['physical_index'] - 1
        else:
            node['nodes'] = post_processing(valid_node_toc_items, node['end_index'])
            if valid_node_toc_items:
                next_start = valid_node_toc_items[0]['physical_index']
                if next_start > node['start_index']:
                    node['end_index'] = next_start - 1

        if node.get('nodes'):
            node['nodes'] = dedupe_structure_nodes(node['nodes'], parent_title=node.get('title'))

    if 'nodes' in node and node['nodes']:
        for child_node in node['nodes']:
            await process_large_node_recursively(child_node, page_list, opt, logger, toc_page_list)

    return node

async def tree_parser(page_list, opt, doc=None, logger=None):
    if len(page_list) == 1:
        if logger:
            logger.info("Single-page PDF detected; skipping TOC/LLM page-index flow")
        return single_page_structure(page_list, doc=doc), _make_toc_verification(1.0, 'single_page')

    check_toc_result = check_toc(page_list, opt, logger=logger)
    print("======================== check_toc_result ========================")
    logger.info(check_toc_result)

    toc_page_list = check_toc_result.get('toc_page_list', [])
    toc_content = check_toc_result.get('toc_content')

    if toc_content and toc_content.strip():
        if check_toc_result.get("page_index_given_in_toc") == "yes":
            print("======================== process_toc_with_page_numbers ========================")
            mode = 'process_toc_with_page_numbers'
        else:
            print("======================== process_toc_no_page_numbers ========================")
            mode = 'process_toc_no_page_numbers'
        toc_with_page_number, toc_verification = await meta_processor(
            page_list,
            mode=mode,
            start_index=1,
            toc_content=toc_content,
            toc_page_list=toc_page_list,
            opt=opt,
            logger=logger)
    else:
        print("======================== process_no_toc ========================")
        toc_with_page_number, toc_verification = await meta_processor(
            page_list,
            mode='process_no_toc',
            start_index=1,
            opt=opt,
            logger=logger)


    print("======================== toc_with_page_number ========================")
    print(toc_with_page_number)

    toc_with_page_number = add_preface_if_needed(toc_with_page_number)
    toc_with_page_number = flatten_toc_subsections(toc_with_page_number, toc_page_list, start_index=1)
    toc_with_page_number = await check_title_appearance_in_start_concurrent(toc_with_page_number, page_list, model=opt.model, logger=logger)

    # Filter out items with None physical_index before post_processings
    valid_toc_items = [item for item in toc_with_page_number if item.get('physical_index') is not None]
    valid_toc_items = deduplicate_toc_items(valid_toc_items, logger=logger)

    toc_tree = post_processing(valid_toc_items, len(page_list))
    toc_tree = group_front_matter_structure(toc_tree, toc_page_list, page_list, start_index=1)
    for node in toc_tree:
        await process_large_node_recursively(node, page_list, opt, logger, toc_page_list)

    return toc_tree, toc_verification


def page_index_main(doc, opt=None, doc_id=None, user_id=None):
    logger = JsonLogger(doc, doc_id=doc_id, user_id=user_id)

    is_valid_pdf = (
        (isinstance(doc, str) and os.path.isfile(doc) and doc.lower().endswith(".pdf")) or
        isinstance(doc, BytesIO)
    )
    if not is_valid_pdf:
        raise ValueError("Unsupported input type. Expected a PDF file path or BytesIO object.")

    print('Parsing PDF...')
    page_list = get_page_tokens(doc, model=opt.model)

    total_tokens = sum(page[1] for page in page_list)
    logger.info({'step': 'pdf_parsed', 'total_page_number': len(page_list), 'total_tokens': total_tokens})

    async def page_index_builder():
        logger.info({'step': 'building_structure', 'message': 'Starting document structure extraction'})
        structure, toc_verification = await tree_parser(page_list, opt, doc=doc, logger=logger)
        logger.info({'step': 'structure_complete', 'message': 'Document structure extraction complete', 'toc_verification': toc_verification})

        if opt.if_add_node_id == 'yes':
            write_node_id(structure)
        if opt.if_add_node_text == 'yes':
            add_node_text_with_labels(structure, page_list)
        if opt.if_add_node_summary == 'yes':
            if opt.if_add_node_text == 'no':
                add_node_text_with_labels(structure, page_list)
            logger.info({'step': 'generating_summaries', 'message': 'Generating node summaries'})
            await generate_summaries_for_structure(structure, model=opt.model, logger=logger)
            if opt.if_add_doc_description == 'yes':
                # Create a clean structure without unnecessary fields for description generation
                clean_structure = create_clean_structure_for_description(structure)
                logger.info({'step': 'generating_doc_description', 'message': 'Generating document description'})
                doc_description = generate_doc_description(clean_structure, model=opt.model, logger=logger)
                structure = structure_to_api_format(structure)
                structure = format_structure(structure, order=['title', 'node_id', 'page_index', 'summary', 'text', 'nodes'])
                return {
                    'doc_name': get_pdf_name(doc),
                    'doc_description': doc_description,
                    'structure': structure,
                    'toc_verification': toc_verification,
                }
        structure = structure_to_api_format(structure)
        structure = format_structure(structure, order=['title', 'node_id', 'page_index', 'summary', 'text', 'nodes'])
        print("======================== Add Doc Data ========================")
        print({
            'doc_name': get_pdf_name(doc),
            'structure': structure,
            'toc_verification': toc_verification,
        })
        return {
            'doc_name': get_pdf_name(doc),
            'structure': structure,
            'toc_verification': toc_verification,
        }

    try:
        result = asyncio.run(page_index_builder())
        logger.info({'step': 'complete', 'message': 'PDF processing finished successfully'})
        logger.finalize(status='completed')
        return result
    except Exception as e:
        logger.error({'step': 'failed', 'message': str(e), 'exception': True})
        logger.finalize(status='failed', error=str(e))
        raise


def page_index(doc, model=None, toc_check_page_num=None, max_page_num_each_node=None, max_token_num_each_node=None,
               if_add_node_id=None, if_add_node_summary=None, if_add_doc_description=None, if_add_node_text=None,
               doc_id=None, user_id=None):

    print(f"page_index: {doc}, {model}, {toc_check_page_num}, {max_page_num_each_node}, {max_token_num_each_node}, {if_add_node_id}, {if_add_node_summary}, {if_add_doc_description}, {if_add_node_text}")
    user_opt = {
        arg: value for arg, value in locals().items()
        if arg != "doc" and value is not None
    }
    opt = ConfigLoader().load()
    # // Set model and retrieve_model in opt
    opt.model = model
    opt.retrieve_model = model
    print("======================== opt ========================")
    print(opt)
    

    # Stop Here for debugging
    return page_index_main(doc, opt, doc_id=doc_id, user_id=user_id)


def validate_and_truncate_physical_indices(toc_with_page_number, page_list_length, start_index=1, logger=None):
    """
    Validates and truncates physical indices that exceed the actual document length.
    This prevents errors when TOC references pages that don't exist in the document (e.g. the file is broken or incomplete).
    """
    if not toc_with_page_number:
        return toc_with_page_number

    max_allowed_page = page_list_length + start_index - 1
    truncated_items = []

    for i, item in enumerate(toc_with_page_number):
        if item.get('physical_index') is not None:
            original_index = item['physical_index']
            try:
                physical_index = int(original_index)
            except (TypeError, ValueError):
                item['physical_index'] = None
                truncated_items.append({
                    'title': item.get('title', 'Unknown'),
                    'original_index': original_index
                })
                if logger:
                    logger.info(f"Removed physical_index for '{item.get('title', 'Unknown')}' (was {original_index}, invalid)")
                continue

            if physical_index < start_index or physical_index > max_allowed_page:
                item['physical_index'] = None
                truncated_items.append({
                    'title': item.get('title', 'Unknown'),
                    'original_index': original_index
                })
                if logger:
                    logger.info(f"Removed physical_index for '{item.get('title', 'Unknown')}' (was {original_index}, too far beyond document)")
            else:
                item['physical_index'] = physical_index

    if truncated_items and logger:
        logger.info(f"Total removed items: {len(truncated_items)}")

    print(f"Document validation: {page_list_length} pages, max allowed index: {max_allowed_page}")
    if truncated_items:
        print(f"Truncated {len(truncated_items)} TOC items that exceeded document length")

    return toc_with_page_number
