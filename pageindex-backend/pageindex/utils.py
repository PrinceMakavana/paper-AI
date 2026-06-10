import litellm
import logging
import os
import re
import tempfile
import textwrap
from datetime import datetime
import time
import json
import PyPDF2
import copy
import asyncio
import pymupdf
from io import BytesIO
from dotenv import load_dotenv
load_dotenv()
import yaml
from pathlib import Path
from types import SimpleNamespace as config
from database import TokenBalanceError, assert_user_has_tokens, record_llm_token_usage

# Backward compatibility: support CHATGPT_API_KEY as alias for OPENAI_API_KEY
if not os.getenv("OPENAI_API_KEY") and os.getenv("CHATGPT_API_KEY"):
    os.environ["OPENAI_API_KEY"] = os.getenv("CHATGPT_API_KEY")

litellm.drop_params = True

LLM_MAX_RETRIES = 10
LLM_RETRY_DELAY_SECONDS = 1


def _is_quota_or_rate_limit_error(error):
    error_text = str(error).lower()
    return (
        isinstance(error, litellm.RateLimitError)
        or "rate limit" in error_text
        or "ratelimit" in error_text
        or "litellm.ratelimiterror" in error_text
        or "resource_exhausted" in error_text
        or "quota" in error_text
        or "quota exceeded" in error_text
        or "connection refused" in error_text
    )

def count_tokens(text, model=None):
    if not text:
        return 0
    return litellm.token_counter(model=model, text=text)


def llm_completion(model, prompt, chat_history=None, return_finish_reason=False, logger=None, operation=None):
    if model:
        model = model.removeprefix("litellm/")
    max_retries = LLM_MAX_RETRIES
    messages = list(chat_history) + [{"role": "user", "content": prompt}] if chat_history else [{"role": "user", "content": prompt}]
    op_name = operation or "llm_completion"

    for attempt in range(1, max_retries + 1):
        try:
            if logger and hasattr(logger, "assert_has_tokens"):
                logger.assert_has_tokens()
            print("LLM Calling..... ====>")
            print("Waiting for 10 seconds before calling LLM")
            time.sleep(10)
            response = litellm.completion(
                model=model,
                messages=messages,
                temperature=0,
                max_retries=0,
                num_retries=0,
            )
            usage = response.usage
            input_tokens = getattr(usage, 'prompt_tokens', 0) or 0
            total_tokens = getattr(usage, 'total_tokens', 0) or 0
            output_tokens = getattr(usage, 'completion_tokens', 0) or 0
            content = response.choices[0].message.content

            print("======================== AI Computed Token Data ========================")
            print(response.usage)

            if logger:
                logger.log_llm_call(
                    operation=op_name,
                    model=model,
                    input_tokens=input_tokens,
                    total_tokens=total_tokens,
                    output_tokens=output_tokens,
                    attempt=attempt,
                    input=prompt,
                    output=content,
                )

            if return_finish_reason:
                finish_reason = "max_output_reached" if response.choices[0].finish_reason == "length" else "finished"
                return content, finish_reason
            return content
        except Exception as e:
            if isinstance(e, TokenBalanceError):
                logging.error(f"Token balance exhausted before LLM call: {e}")
                if logger:
                    logger.log_llm_call(
                        operation=op_name,
                        total_tokens=0,
                        model=model,
                        input_tokens=0,
                        output_tokens=0,
                        attempt=attempt,
                        error=e,
                    )
                raise

            logging.error(f"Error: {e}")
            if logger:
                logger.log_llm_call(
                    operation=op_name,
                    total_tokens=0,
                    model=model,
                    input_tokens=0,
                    output_tokens=0,
                    attempt=attempt,
                    error=e,
                )

            if _is_quota_or_rate_limit_error(e):
                logging.error(f"Non-retryable LLM quota/rate-limit error after attempt {attempt}: {e}")
                if return_finish_reason:
                    return "", "error"
                return ""

            if attempt >= max_retries:
                logging.error('Max retries reached for prompt: ' + prompt)
                if return_finish_reason:
                    return "", "error"
                return ""

            print(f'************* Retrying attempt {attempt + 1}/{max_retries} *************')
            time.sleep(LLM_RETRY_DELAY_SECONDS)



async def llm_acompletion(model, prompt, logger=None, operation=None):
    if model:
        model = model.removeprefix("litellm/")
    max_retries = LLM_MAX_RETRIES
    messages = [{"role": "user", "content": prompt}]
    op_name = operation or "llm_acompletion"

    for attempt in range(1, max_retries + 1):
        try:
            if logger and hasattr(logger, "assert_has_tokens"):
                logger.assert_has_tokens()
            print("LLM ACompletion Calling: =====>", model)
            # wait for 10 sec
            print("Waiting for 10 seconds")
            time.sleep(10)
            response = await litellm.acompletion(
                model=model,
                messages=messages,
                temperature=0,
                max_retries=0,
                num_retries=0,
            )
            usage = response.usage
            input_tokens = getattr(usage, 'prompt_tokens', 0) or 0
            output_tokens = getattr(usage, 'completion_tokens', 0) or 0
            total_tokens = getattr(usage, 'total_tokens', 0) or 0
            content = response.choices[0].message.content

            if logger:
                logger.log_llm_call(
                    operation=op_name,
                    model=model,
                    input_tokens=input_tokens,
                    total_tokens=total_tokens,
                    output_tokens=output_tokens,
                    attempt=attempt,
                    input=prompt,
                    output=content,
                )

            return content
        except Exception as e:
            if isinstance(e, TokenBalanceError):
                logging.error(f"Token balance exhausted before async LLM call: {e}")
                if logger:
                    logger.log_llm_call(
                        operation=op_name,
                        model=model,
                        input_tokens=0,
                        total_tokens=0,
                        output_tokens=0,
                        attempt=attempt,
                        error=e,
                    )
                raise

            logging.error(f"Error: {e}")
            if logger:
                logger.log_llm_call(
                    operation=op_name,
                    model=model,
                    input_tokens=0,
                    output_tokens=0,
                    attempt=attempt,
                    error=e,
                )

            if _is_quota_or_rate_limit_error(e):
                logging.error(f"Non-retryable LLM quota/rate-limit error after attempt {attempt}: {e}")
                return ""

            if logger:
                logger.info(f"Max retries: {max_retries} and attempt: {attempt}")
            print(f"Max retries: {max_retries} and attempt: {attempt}")

            if attempt >= max_retries:
                logging.error('Max retries reached for prompt: ' + prompt + ' and attempt: ' + str(attempt))
                return ""

            print(f'************* Retrying attempt {attempt + 1}/{max_retries} *************')
            await asyncio.sleep(LLM_RETRY_DELAY_SECONDS)


def get_json_content(response):
    start_idx = response.find("```json")
    if start_idx != -1:
        start_idx += 7
        response = response[start_idx:]

    end_idx = response.rfind("```")
    if end_idx != -1:
        response = response[:end_idx]

    json_content = response.strip()
    return json_content


def extract_json(content):
    try:
        # First, try to extract JSON enclosed within ```json and ```
        start_idx = content.find("```json")
        if start_idx != -1:
            start_idx += 7  # Adjust index to start after the delimiter
            end_idx = content.rfind("```")
            json_content = content[start_idx:end_idx].strip()
        else:
            # If no delimiters, assume entire content could be JSON
            json_content = content.strip()

        # Clean up common issues that might cause parsing errors
        json_content = json_content.replace('None', 'null')  # Replace Python None with JSON null
        json_content = json_content.replace('\n', ' ').replace('\r', ' ')  # Remove newlines
        json_content = ' '.join(json_content.split())  # Normalize whitespace

        # Attempt to parse and return the JSON object
        return json.loads(json_content)
    except json.JSONDecodeError as e:
        logging.error(f"Failed to extract JSON: {e}")
        # Try to clean up the content further if initial parsing fails
        try:
            # Remove any trailing commas before closing brackets/braces
            json_content = json_content.replace(',]', ']').replace(',}', '}')
            return json.loads(json_content)
        except:
            logging.error("Failed to parse JSON even after cleanup")
            return {}
    except Exception as e:
        logging.error(f"Unexpected error while extracting JSON: {e}")
        return {}

def write_node_id(data, node_id=0):
    if isinstance(data, dict):
        data['node_id'] = str(node_id).zfill(4)
        node_id += 1
        for key in list(data.keys()):
            if 'nodes' in key:
                node_id = write_node_id(data[key], node_id)
    elif isinstance(data, list):
        for index in range(len(data)):
            node_id = write_node_id(data[index], node_id)
    return node_id

def get_nodes(structure):
    if isinstance(structure, dict):
        structure_node = copy.deepcopy(structure)
        structure_node.pop('nodes', None)
        nodes = [structure_node]
        for key in list(structure.keys()):
            if 'nodes' in key:
                nodes.extend(get_nodes(structure[key]))
        return nodes
    elif isinstance(structure, list):
        nodes = []
        for item in structure:
            nodes.extend(get_nodes(item))
        return nodes

def structure_to_list(structure):
    if isinstance(structure, dict):
        nodes = []
        nodes.append(structure)
        if 'nodes' in structure:
            nodes.extend(structure_to_list(structure['nodes']))
        return nodes
    elif isinstance(structure, list):
        nodes = []
        for item in structure:
            nodes.extend(structure_to_list(item))
        return nodes


def get_leaf_nodes(structure):
    if isinstance(structure, dict):
        if not structure['nodes']:
            structure_node = copy.deepcopy(structure)
            structure_node.pop('nodes', None)
            return [structure_node]
        else:
            leaf_nodes = []
            for key in list(structure.keys()):
                if 'nodes' in key:
                    leaf_nodes.extend(get_leaf_nodes(structure[key]))
            return leaf_nodes
    elif isinstance(structure, list):
        leaf_nodes = []
        for item in structure:
            leaf_nodes.extend(get_leaf_nodes(item))
        return leaf_nodes

def is_leaf_node(data, node_id):
    # Helper function to find the node by its node_id
    def find_node(data, node_id):
        if isinstance(data, dict):
            if data.get('node_id') == node_id:
                return data
            for key in data.keys():
                if 'nodes' in key:
                    result = find_node(data[key], node_id)
                    if result:
                        return result
        elif isinstance(data, list):
            for item in data:
                result = find_node(item, node_id)
                if result:
                    return result
        return None

    # Find the node with the given node_id
    node = find_node(data, node_id)

    # Check if the node is a leaf node
    if node and not node.get('nodes'):
        return True
    return False

def get_last_node(structure):
    return structure[-1]


def extract_text_from_pdf(pdf_path):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    ###return text not list
    text=""
    for page_num in range(len(pdf_reader.pages)):
        page = pdf_reader.pages[page_num]
        text+=page.extract_text()
    return text

def get_pdf_title(pdf_path):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    meta = pdf_reader.metadata
    title = meta.title if meta and meta.title else 'Untitled'
    return title

def get_text_of_pages(pdf_path, start_page, end_page, tag=True):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    text = ""
    for page_num in range(start_page-1, end_page):
        page = pdf_reader.pages[page_num]
        page_text = page.extract_text()
        if tag:
            text += f"<start_index_{page_num+1}>\n{page_text}\n<end_index_{page_num+1}>\n"
        else:
            text += page_text
    return text

def get_first_start_page_from_text(text):
    start_page = -1
    start_page_match = re.search(r'<start_index_(\d+)>', text)
    if start_page_match:
        start_page = int(start_page_match.group(1))
    return start_page

def get_last_start_page_from_text(text):
    start_page = -1
    # Find all matches of start_index tags
    start_page_matches = re.finditer(r'<start_index_(\d+)>', text)
    # Convert iterator to list and get the last match if any exist
    matches_list = list(start_page_matches)
    if matches_list:
        start_page = int(matches_list[-1].group(1))
    return start_page


def sanitize_filename(filename, replacement='-'):
    # In Linux, only '/' and '\0' (null) are invalid in filenames.
    # Null can't be represented in strings, so we only handle '/'.
    return filename.replace('/', replacement)

def get_pdf_name(pdf_path):
    # Extract PDF name
    if isinstance(pdf_path, str):
        pdf_name = os.path.basename(pdf_path)
    elif isinstance(pdf_path, BytesIO):
        pdf_reader = PyPDF2.PdfReader(pdf_path)
        meta = pdf_reader.metadata
        pdf_name = meta.title if meta and meta.title else 'Untitled'
        pdf_name = sanitize_filename(pdf_name)
    return pdf_name


class JsonLogger:
    LOG_FILENAME = "file_process_log.json"

    @staticmethod
    def _temp_upload_root() -> Path:
        default = os.path.join(tempfile.gettempdir(), "pageindex")
        return Path(os.getenv("PAGEINDEX_TEMP_ROOT", default))

    def __init__(self, file_path, doc_id=None, user_id=None):
        pdf_name = get_pdf_name(file_path)
        self.doc_id = doc_id
        self.user_id = user_id
        safe_doc_id = (doc_id or "unknown").strip()
        self._log_dir = self._temp_upload_root() / safe_doc_id / "logs"
        self._log_dir.mkdir(parents=True, exist_ok=True)
        self.log_data = {
            "pdf_name": pdf_name,
            "doc_id": doc_id,
            "user_id": user_id,
            "started_at": datetime.now().isoformat(),
            "status": "running",
            "completed_at": None,
            "token_stats": {
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_tokens": 0,
                "llm_call_count": 0,
                "llm_error_count": 0,
            },
            "steps": [],
        }
        self._write()

    def _write(self):
        # return

        # print(self.log_data)
        with open(self._filepath(), "w") as f:
            json.dump(self.log_data, f, indent=2)

    def _add_step(self, level, message):
        if isinstance(message, dict):
            entry = {"level": level, "timestamp": datetime.now().isoformat()}
            entry.update(message)
        else:
            entry = {"level": level, "timestamp": datetime.now().isoformat(), "message": str(message)}
        self.log_data["steps"].append(entry)
        self._write()

    def log_llm_call(self, operation, model, input_tokens, output_tokens, total_tokens, attempt=1, error=None, input=None, output=None):
        stats = self.log_data["token_stats"]
        if error:
            stats["llm_error_count"] += 1
        else:
            stats["total_input_tokens"] += input_tokens
            stats["total_output_tokens"] += output_tokens
            stats["total_tokens"] += total_tokens
            stats["llm_call_count"] += 1
            record_llm_token_usage(self.doc_id, self.user_id, total_tokens)

        entry = {
            "level": "LLM_ERROR" if error else "LLM_CALL",
            "timestamp": datetime.now().isoformat(),
            "operation": operation,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "attempt": attempt,
        }
        if input is not None:
            entry["input"] = input
        if output is not None:
            entry["output"] = output
        if error:
            entry["error"] = str(error)

        self.log_data["steps"].append(entry)
        self._write()

    def finalize(self, status="completed", error=None):
        self.log_data["status"] = status
        self.log_data["completed_at"] = datetime.now().isoformat()
        if error:
            self.log_data["error"] = str(error)
        self._write()

        filepath = self._filepath()
        upload_succeeded = False

        if status == "failed":
            try:
                from storage.s3 import JSON_CONTENT_TYPE, build_object_name, upload_bytes

                object_name = build_object_name(
                    self.user_id,
                    self.doc_id or "document",
                    self.LOG_FILENAME,
                )
                with open(filepath, "rb") as log_file:
                    upload_bytes(log_file.read(), object_name, JSON_CONTENT_TYPE)
                upload_succeeded = True
                logging.info("Uploaded processing log to S3: %s", object_name)
            except Exception as exc:
                logging.error("Failed to upload processing log to S3: %s", exc)

        if status == "completed" or upload_succeeded:
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
            except Exception as exc:
                logging.error("Failed to delete local processing log: %s", exc)

    def info(self, message, **kwargs):
        self._add_step("INFO", message)

    def error(self, message, **kwargs):
        self._add_step("ERROR", message)

    def debug(self, message, **kwargs):
        self._add_step("DEBUG", message)

    def exception(self, message, **kwargs):
        self._add_step("ERROR", {"message": str(message), "exception": True})

    def _filepath(self):
        return str(self._log_dir / self.LOG_FILENAME)

    def assert_has_tokens(self):
        assert_user_has_tokens(self.user_id)


class ChatLogger:
    _LOG_DIR = Path(__file__).resolve().parent.parent / "logs" / "chat"

    def __init__(self, doc_id: str, session_id: str = None, user_id: str = None):
        import uuid as _uuid
        self.doc_id = doc_id
        self.user_id = user_id
        self._LOG_DIR.mkdir(parents=True, exist_ok=True)

        new_session = session_id is None
        self.session_id = session_id or str(_uuid.uuid4())
        self.filename = f"chat_{doc_id}_{self.session_id}.json"
        filepath = self._LOG_DIR / self.filename

        if not new_session and filepath.exists():
            with open(filepath, encoding="utf-8") as f:
                self.log_data = json.load(f)
        else:
            self.log_data = {
                "session_id": self.session_id,
                "doc_id": doc_id,
                "user_id": user_id,
                "started_at": datetime.now().isoformat(),
                "token_stats": {
                    "total_input_tokens": 0,
                    "total_output_tokens": 0,
                    "total_tokens": 0,
                    "llm_call_count": 0,
                    "message_count": 0,
                },
                "messages": [],
            }
            self._write()

    def _write(self):
        return

        # print(self.log_data)
        # with open(self._filepath(), "w") as f:
        #     json.dump(self.log_data, f, indent=2)


    def log_user_message(self, content: str):
        self.log_data["token_stats"]["message_count"] += 1
        self.log_data["messages"].append({
            "timestamp": datetime.now().isoformat(),
            "role": "user",
            "content": content,
        })
        self._write()

    def log_llm_call(self, operation, model, input_tokens, output_tokens, total_tokens, attempt=1, error=None, input=None, output=None):
        """Compatible with llm_completion/llm_acompletion logger interface."""
        stats = self.log_data["token_stats"]
        if not error:
            stats["total_input_tokens"] += input_tokens
            stats["total_output_tokens"] += output_tokens
            stats["total_tokens"] += total_tokens
            stats["llm_call_count"] += 1
            record_llm_token_usage(self.doc_id, self.user_id, total_tokens)
            if output:
                self.log_data["messages"].append({
                    "timestamp": datetime.now().isoformat(),
                    "role": "assistant",
                    "content": output,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                    "operation": operation,
                    "model": model,
                })
        self._write()

    def _filepath(self):
        return str(self._LOG_DIR / self.filename)

    def assert_has_tokens(self):
        assert_user_has_tokens(self.user_id)


def list_to_tree(data):
    def get_parent_structure(structure):
        """Helper function to get the parent structure code"""
        if not structure:
            return None
        parts = str(structure).split('.')
        return '.'.join(parts[:-1]) if len(parts) > 1 else None

    # First pass: Create nodes and track parent-child relationships
    nodes = {}
    root_nodes = []

    for item in data:
        structure = item.get('structure')
        node = {
            'title': item.get('title'),
            'start_index': item.get('start_index'),
            'end_index': item.get('end_index'),
            'nodes': []
        }

        nodes[structure] = node

        # Find parent
        parent_structure = get_parent_structure(structure)

        if parent_structure:
            # Add as child to parent if parent exists
            if parent_structure in nodes:
                nodes[parent_structure]['nodes'].append(node)
            else:
                root_nodes.append(node)
        else:
            # No parent, this is a root node
            root_nodes.append(node)

    # Helper function to clean empty children arrays
    def clean_node(node):
        if not node['nodes']:
            del node['nodes']
        else:
            for child in node['nodes']:
                clean_node(child)
        return node

    # Clean and return the tree
    return [clean_node(node) for node in root_nodes]

def add_preface_if_needed(data):
    if not isinstance(data, list) or not data:
        return data

    if data[0]['physical_index'] is not None and data[0]['physical_index'] > 1:
        preface_node = {
            "structure": "0",
            "title": "Preface",
            "physical_index": 1,
        }
        data.insert(0, preface_node)
    return data



def get_page_tokens(pdf_path, model=None, pdf_parser="PyPDF2"):
    if pdf_parser == "PyPDF2":
        pdf_reader = PyPDF2.PdfReader(pdf_path)
        page_list = []
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            page_text = page.extract_text()
            token_length = litellm.token_counter(model=model, text=page_text)
            page_list.append((page_text, token_length))
        return page_list
    elif pdf_parser == "PyMuPDF":
        if isinstance(pdf_path, BytesIO):
            pdf_stream = pdf_path
            doc = pymupdf.open(stream=pdf_stream, filetype="pdf")
        elif isinstance(pdf_path, str) and os.path.isfile(pdf_path) and pdf_path.lower().endswith(".pdf"):
            doc = pymupdf.open(pdf_path)
        page_list = []
        for page in doc:
            page_text = page.get_text()
            token_length = litellm.token_counter(model=model, text=page_text)
            page_list.append((page_text, token_length))
        return page_list
    else:
        raise ValueError(f"Unsupported PDF parser: {pdf_parser}")



def get_text_of_pdf_pages(pdf_pages, start_page, end_page):
    text = ""
    for page_num in range(start_page-1, end_page):
        text += pdf_pages[page_num][0]
    return text

def get_text_of_pdf_pages_with_labels(pdf_pages, start_page, end_page):
    text = ""
    for page_num in range(start_page-1, end_page):
        text += f"<physical_index_{page_num+1}>\n{pdf_pages[page_num][0]}\n<physical_index_{page_num+1}>\n"
    return text

def get_number_of_pages(pdf_path):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    num = len(pdf_reader.pages)
    return num



def post_processing(structure, end_physical_index):
    # First convert page_number to start_index in flat list
    for i, item in enumerate(structure):
        item['start_index'] = item.get('physical_index')
        if i < len(structure) - 1:
            if structure[i + 1].get('appear_start') == 'yes':
                item['end_index'] = structure[i + 1]['physical_index']-1
            else:
                item['end_index'] = structure[i + 1]['physical_index']
        else:
            item['end_index'] = end_physical_index
        start = item.get('start_index')
        end = item.get('end_index')
        if start is not None and end is not None and end < start:
            item['end_index'] = start
    tree = list_to_tree(structure)
    if len(tree)!=0:
        return tree
    else:
        ### remove appear_start
        for node in structure:
            node.pop('appear_start', None)
            node.pop('physical_index', None)
        return structure

def clean_structure_post(data):
    if isinstance(data, dict):
        data.pop('page_number', None)
        data.pop('start_index', None)
        data.pop('end_index', None)
        if 'nodes' in data:
            clean_structure_post(data['nodes'])
    elif isinstance(data, list):
        for section in data:
            clean_structure_post(section)
    return data

def remove_fields(data, fields=['text']):
    if isinstance(data, dict):
        return {k: remove_fields(v, fields)
            for k, v in data.items() if k not in fields}
    elif isinstance(data, list):
        return [remove_fields(item, fields) for item in data]
    return data

def print_toc(tree, indent=0):
    for node in tree:
        print('  ' * indent + node['title'])
        if node.get('nodes'):
            print_toc(node['nodes'], indent + 1)

def print_json(data, max_len=40, indent=2):
    def simplify_data(obj):
        if isinstance(obj, dict):
            return {k: simplify_data(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [simplify_data(item) for item in obj]
        elif isinstance(obj, str) and len(obj) > max_len:
            return obj[:max_len] + '...'
        else:
            return obj

    simplified = simplify_data(data)
    print(json.dumps(simplified, indent=indent, ensure_ascii=False))


def remove_structure_text(data):
    if isinstance(data, dict):
        data.pop('text', None)
        if 'nodes' in data:
            remove_structure_text(data['nodes'])
    elif isinstance(data, list):
        for item in data:
            remove_structure_text(item)
    return data


def check_token_limit(structure, limit=110000):
    list = structure_to_list(structure)
    for node in list:
        num_tokens = count_tokens(node['text'], model=None)
        if num_tokens > limit:
            print(f"Node ID: {node['node_id']} has {num_tokens} tokens")
            print("Start Index:", node['start_index'])
            print("End Index:", node['end_index'])
            print("Title:", node['title'])
            print("\n")


def convert_physical_index_to_int(data):
    if isinstance(data, list):
        for i in range(len(data)):
            # Check if item is a dictionary and has 'physical_index' key
            if isinstance(data[i], dict) and 'physical_index' in data[i]:
                if isinstance(data[i]['physical_index'], str):
                    if data[i]['physical_index'].startswith('<physical_index_'):
                        data[i]['physical_index'] = int(data[i]['physical_index'].split('_')[-1].rstrip('>').strip())
                    elif data[i]['physical_index'].startswith('physical_index_'):
                        data[i]['physical_index'] = int(data[i]['physical_index'].split('_')[-1].strip())
    elif isinstance(data, str):
        if data.startswith('<physical_index_'):
            data = int(data.split('_')[-1].rstrip('>').strip())
        elif data.startswith('physical_index_'):
            data = int(data.split('_')[-1].strip())
        # Check data is int
        if isinstance(data, int):
            return data
        else:
            return None
    return data


def roman_to_int(value):
    """Convert a roman numeral string to int; return None if not a valid numeral."""
    if not value or not isinstance(value, str):
        return None
    roman = value.strip().lower()
    if not roman or not re.match(r'^[ivxlcdm]+$', roman):
        return None
    numerals = {'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100, 'd': 500, 'm': 1000}
    total = 0
    prev = 0
    for char in reversed(roman):
        current = numerals.get(char)
        if current is None:
            return None
        if current < prev:
            total -= current
        else:
            total += current
        prev = current
    return total if total > 0 else None


def parse_toc_page_number(page):
    """Parse TOC page field: integer, numeric string, or roman numeral."""
    if page is None:
        return None
    if isinstance(page, int):
        return page
    if isinstance(page, str):
        stripped = page.strip()
        if stripped.isdigit():
            return int(stripped)
        return roman_to_int(stripped)
    return None


def convert_page_to_int(data):
    for item in data:
        if 'page' in item:
            parsed = parse_toc_page_number(item['page'])
            if parsed is not None:
                item['page'] = parsed
    return data


def _structure_depth(structure):
    if structure is None:
        return 0
    structure_str = str(structure).strip()
    if not structure_str or structure_str.lower() == 'none':
        return 0
    return structure_str.count('.') + 1


def _toc_physical_range(toc_page_list, start_index=1):
    if not toc_page_list:
        return None, None
    return min(toc_page_list) + start_index, max(toc_page_list) + start_index


def flatten_toc_subsections(toc_items, toc_page_list, start_index=1):
    """On TOC pages, keep chapter-level entries only (drop nested subsection lines)."""
    if not toc_page_list or not toc_items:
        return toc_items

    toc_start, toc_end = _toc_physical_range(toc_page_list, start_index)
    filtered = []
    for item in toc_items:
        physical_index = item.get('physical_index')
        if (
            physical_index is not None
            and toc_start <= physical_index <= toc_end
            and _structure_depth(item.get('structure')) > 1
        ):
            continue
        filtered.append(item)
    return filtered if filtered else toc_items


def _detect_book_title(page_list, start_index=1):
    if not page_list:
        return "Document"
    for page_offset in range(min(3, len(page_list))):
        for line in (page_list[page_offset][0] or '').splitlines():
            stripped = line.strip()
            if not stripped or len(stripped) > 120:
                continue
            if re.search(r'core\s+java|volume\s+i', stripped, re.IGNORECASE):
                return stripped
    return "Document"


def _detect_volume_title(page_list, start_index=1):
    for page_offset in range(min(4, len(page_list))):
        for line in (page_list[page_offset][0] or '').splitlines():
            stripped = line.strip()
            if re.search(r'volume\s+i', stripped, re.IGNORECASE):
                return stripped
    return "Volume I—Fundamentals"


def group_front_matter_structure(tree, toc_page_list, page_list, start_index=1):
    """Group title/contents nodes under a book wrapper similar to the PageIndex API."""
    if not tree or not toc_page_list:
        return tree

    toc_start, toc_end = _toc_physical_range(toc_page_list, start_index)
    preface_nodes = []
    title_nodes = []
    contents_nodes = []
    body_nodes = []

    for node in tree:
        page = node.get('start_index', 1)
        title_lower = (node.get('title') or '').lower()
        if page <= 1 or (page <= 2 and 'preface' in title_lower):
            preface_nodes.append(node)
        elif page < toc_start:
            title_nodes.append(node)
        elif toc_start <= page <= toc_end:
            contents_nodes.append(node)
        else:
            body_nodes.append(node)

    if not title_nodes and not contents_nodes:
        return tree

    book_title = _detect_book_title(page_list, start_index)
    volume_title = _detect_volume_title(page_list, start_index)

    volume_nodes = title_nodes + contents_nodes
    if not volume_nodes:
        return preface_nodes + body_nodes if preface_nodes or body_nodes else tree

    volume_start = min(n.get('start_index', toc_start) for n in volume_nodes)
    volume_end = max(n.get('end_index', n.get('start_index', toc_end)) for n in volume_nodes)

    volume_node = {
        'title': volume_title,
        'start_index': volume_start,
        'end_index': volume_end,
        'nodes': volume_nodes,
    }

    book_start = volume_start
    book_end = volume_end
    book_node = {
        'title': book_title if book_title != 'Document' else 'Core Java®',
        'start_index': book_start,
        'end_index': book_end,
        'nodes': [volume_node],
    }

    result = []
    if preface_nodes:
        result.extend(preface_nodes)
    else:
        preface_candidate = next((n for n in tree if 'preface' in (n.get('title') or '').lower()), None)
        if preface_candidate and preface_candidate not in volume_nodes:
            result.append(preface_candidate)

    result.append(book_node)
    result.extend(body_nodes)
    return result


def dedupe_structure_nodes(nodes, parent_title=None):
    """Remove duplicate child nodes by title and start page."""
    if not isinstance(nodes, list):
        return nodes

    seen = set()
    deduped = []
    parent_key = normalize_for_title_match(parent_title) if parent_title else None

    for node in nodes:
        title_key = normalize_for_title_match(node.get('title'))
        page = node.get('start_index') or node.get('page_index')
        identity = (title_key, page)
        if identity in seen:
            continue
        if parent_key and title_key == parent_key:
            continue
        seen.add(identity)
        if node.get('nodes'):
            node['nodes'] = dedupe_structure_nodes(node['nodes'], parent_title=node.get('title'))
        deduped.append(node)
    return deduped


def normalize_for_title_match(text):
    return re.sub(r'[^a-z0-9]+', '', (text or '').lower())


def structure_to_api_format(structure):
    """Convert internal tree (start_index/end_index) to API shape (page_index only)."""
    if isinstance(structure, dict):
        node = {}
        page_index = structure.get('page_index')
        if page_index is None:
            page_index = structure.get('start_index')
        if page_index is not None:
            node['page_index'] = page_index
        for key in ('title', 'node_id', 'text', 'summary'):
            if key in structure:
                node[key] = structure[key]
        if structure.get('nodes'):
            node['nodes'] = structure_to_api_format(structure['nodes'])
        return node
    if isinstance(structure, list):
        return [structure_to_api_format(item) for item in structure]
    return structure


def add_node_text(node, pdf_pages):
    if isinstance(node, dict):
        start_page = node.get('start_index')
        end_page = node.get('end_index')
        node['text'] = get_text_of_pdf_pages(pdf_pages, start_page, end_page)
        if 'nodes' in node:
            add_node_text(node['nodes'], pdf_pages)
    elif isinstance(node, list):
        for index in range(len(node)):
            add_node_text(node[index], pdf_pages)
    return


def add_node_text_with_labels(node, pdf_pages):
    if isinstance(node, dict):
        start_page = node.get('start_index')
        end_page = node.get('end_index')
        node['text'] = get_text_of_pdf_pages_with_labels(pdf_pages, start_page, end_page)
        if 'nodes' in node:
            add_node_text_with_labels(node['nodes'], pdf_pages)
    elif isinstance(node, list):
        for index in range(len(node)):
            add_node_text_with_labels(node[index], pdf_pages)
    return


async def generate_node_summary(node, model=None, logger=None):
    prompt = f"""You are given a part of a document, your task is to generate a description of the partial document about what are main points covered in the partial document.

    Partial Document Text: {node['text']}

    Directly return the description, do not include any other text.
    """
    print("======================== generate_node_summary llm call ========================")
    response = await llm_acompletion(model, prompt, logger=logger, operation="generate_node_summary")
    return response


async def generate_summaries_for_structure(structure, model=None, logger=None):
    nodes = structure_to_list(structure)
    tasks = [generate_node_summary(node, model=model, logger=logger) for node in nodes]
    summaries = await asyncio.gather(*tasks)

    for node, summary in zip(nodes, summaries):
        node['summary'] = summary
    return structure


def create_clean_structure_for_description(structure):
    """
    Create a clean structure for document description generation,
    excluding unnecessary fields like 'text'.
    """
    if isinstance(structure, dict):
        clean_node = {}
        # Only include essential fields for description
        for key in ['title', 'node_id', 'summary', 'prefix_summary']:
            if key in structure:
                clean_node[key] = structure[key]

        # Recursively process child nodes
        if 'nodes' in structure and structure['nodes']:
            clean_node['nodes'] = create_clean_structure_for_description(structure['nodes'])

        return clean_node
    elif isinstance(structure, list):
        return [create_clean_structure_for_description(item) for item in structure]
    else:
        return structure


def generate_doc_description(structure, model=None, logger=None):
    prompt = f"""Your are an expert in generating descriptions for a document.
    You are given a structure of a document. Your task is to generate a one-sentence description for the document, which makes it easy to distinguish the document from other documents.

    Document Structure: {structure}

    Directly return the description, do not include any other text.
    """
    print("======================== generate_doc_description llm call ========================")
    response = llm_completion(model, prompt, logger=logger, operation="generate_doc_description")
    return response


def reorder_dict(data, key_order):
    if not key_order:
        return data
    return {key: data[key] for key in key_order if key in data}


def format_structure(structure, order=None):
    if not order:
        return structure
    if isinstance(structure, dict):
        if 'nodes' in structure:
            structure['nodes'] = format_structure(structure['nodes'], order)
        if not structure.get('nodes'):
            structure.pop('nodes', None)
        structure = reorder_dict(structure, order)
    elif isinstance(structure, list):
        structure = [format_structure(item, order) for item in structure]
    return structure


class ConfigLoader:
    def __init__(self, default_path: str = None):
        if default_path is None:
            default_path = Path(__file__).parent / "config.yaml"
        self._default_dict = self._load_yaml(default_path)

    @staticmethod
    def _load_yaml(path):
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def _validate_keys(self, user_dict):
        unknown_keys = set(user_dict) - set(self._default_dict)
        if unknown_keys:
            raise ValueError(f"Unknown config keys: {unknown_keys}")

    def load(self, user_opt=None) -> config:
        """
        Load the configuration, merging user options with default values.
        """
        if user_opt is None:
            user_dict = {}
        elif isinstance(user_opt, config):
            user_dict = vars(user_opt)
        elif isinstance(user_opt, dict):
            user_dict = user_opt
        else:
            raise TypeError("user_opt must be dict, config(SimpleNamespace) or None")

        self._validate_keys(user_dict)
        merged = {**self._default_dict, **user_dict}
        return config(**merged)

def create_node_mapping(tree):
    """Create a flat dict mapping node_id to node for quick lookup."""
    mapping = {}
    def _traverse(nodes):
        for node in nodes:
            if node.get('node_id'):
                mapping[node['node_id']] = node
            if node.get('nodes'):
                _traverse(node['nodes'])
    _traverse(tree)
    return mapping

def print_tree(tree, indent=0):
    for node in tree:
        summary = node.get('summary') or node.get('prefix_summary', '')
        summary_str = f"  —  {summary[:60]}..." if summary else ""
        print('  ' * indent + f"[{node.get('node_id', '?')}] {node.get('title', '')}{summary_str}")
        if node.get('nodes'):
            print_tree(node['nodes'], indent + 1)

def print_wrapped(text, width=100):
    for line in text.splitlines():
        print(textwrap.fill(line, width=width))
