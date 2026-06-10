import importlib.util
import json
import os
import sys
import types
import unittest
from unittest.mock import MagicMock

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, BACKEND_DIR)

if 'database' not in sys.modules:
    database_stub = MagicMock()
    database_stub.TokenBalanceError = Exception
    database_stub.assert_user_has_tokens = MagicMock()
    database_stub.record_llm_token_usage = MagicMock()
    sys.modules['database'] = database_stub


def _load_module(module_name, path):
    spec = importlib.util.spec_from_file_location(module_name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


utils = _load_module('pageindex.utils', os.path.join(BACKEND_DIR, 'pageindex', 'utils.py'))
pageindex_pkg = types.ModuleType('pageindex')
pageindex_pkg.utils = utils
sys.modules['pageindex'] = pageindex_pkg

page_index = _load_module(
    'pageindex.page_index',
    os.path.join(BACKEND_DIR, 'pageindex', 'page_index.py'),
)

dedupe_structure_nodes = utils.dedupe_structure_nodes
flatten_toc_subsections = utils.flatten_toc_subsections
group_front_matter_structure = utils.group_front_matter_structure
parse_toc_page_number = utils.parse_toc_page_number
post_processing = utils.post_processing
roman_to_int = utils.roman_to_int
structure_to_api_format = utils.structure_to_api_format
looks_like_toc_continuation = page_index.looks_like_toc_continuation
looks_like_toc_candidate = page_index.looks_like_toc_candidate
parse_toc_content_heuristic = page_index.parse_toc_content_heuristic


GOLDEN_PATH = os.path.join(
    os.path.dirname(__file__),
    '..',
    'page_index_need_result_output.json',
)


def walk_nodes(structure):
    if isinstance(structure, dict):
        yield structure
        for child in structure.get('nodes') or []:
            yield from walk_nodes(child)
    elif isinstance(structure, list):
        for item in structure:
            yield from walk_nodes(item)


class TestTocUtilities(unittest.TestCase):
    def test_roman_to_int(self):
        self.assertEqual(roman_to_int('xix'), 19)
        self.assertEqual(roman_to_int('xxv'), 25)
        self.assertEqual(parse_toc_page_number('287'), 287)
        self.assertEqual(parse_toc_page_number('xix'), 19)

    def test_flatten_toc_subsections(self):
        toc_page_list = [5, 6, 7]
        items = [
            {'title': 'Chapter 1', 'structure': '1', 'physical_index': 7},
            {'title': 'Simple', 'structure': '1.2.1', 'physical_index': 7},
            {'title': 'Chapter 6', 'structure': '6', 'physical_index': 28},
        ]
        filtered = flatten_toc_subsections(items, toc_page_list, start_index=1)
        titles = [item['title'] for item in filtered]
        self.assertIn('Chapter 1', titles)
        self.assertNotIn('Simple', titles)
        self.assertIn('Chapter 6', titles)

    def test_post_processing_clamps_invalid_end_index(self):
        structure = [
            {'title': 'A', 'physical_index': 11, 'appear_start': 'yes'},
            {'title': 'B', 'physical_index': 9, 'appear_start': 'yes'},
        ]
        tree = post_processing(structure, end_physical_index=20)
        flat = list(walk_nodes(tree))
        node_a = next(node for node in flat if node['title'] == 'A')
        self.assertGreaterEqual(node_a['end_index'], node_a['start_index'])

    def test_structure_to_api_format(self):
        internal = [{
            'title': 'Preface',
            'node_id': '0000',
            'start_index': 1,
            'end_index': 6,
            'nodes': [],
        }]
        api = structure_to_api_format(internal)
        self.assertEqual(api[0]['page_index'], 1)
        self.assertNotIn('start_index', api[0])
        self.assertNotIn('end_index', api[0])

    def test_dedupe_structure_nodes(self):
        nodes = [
            {'title': 'Preface', 'start_index': 20, 'nodes': []},
            {'title': 'Preface', 'start_index': 20, 'nodes': []},
            {'title': 'Chapter 6', 'start_index': 28, 'nodes': []},
        ]
        deduped = dedupe_structure_nodes(nodes, parent_title='Document')
        self.assertEqual(len(deduped), 2)

    def test_toc_continuation_heuristic(self):
        contents_page = (
            "Contents\n\n"
            "Chapter 3: Fundamental Programming Structures in Java 41\n"
            "3.1 A Simple Java Program 42\n"
            "3.2 Comments 46\n"
            "Chapter 4: Objects and Classes 129\n"
        )
        self.assertTrue(looks_like_toc_continuation(contents_page))
        self.assertTrue(looks_like_toc_candidate(contents_page))

    def test_parse_toc_content_heuristic(self):
        sample = (
            "Contents\n"
            "xix Preface : \n"
            "1 Chapter 1: An Introduction to Java : \n"
            "1 Java as a Programming Platform :  1.1\n"
            "Chapter 6: Interfaces, Lambda Expressions, and Inner Classes 287\n"
        )
        entries = parse_toc_content_heuristic(sample)
        self.assertGreaterEqual(len(entries), 4)
        titles = [entry['title'] for entry in entries]
        self.assertTrue(any('Preface' in title for title in titles))
        self.assertTrue(any('Chapter 6' in title for title in titles))
        chapter_six = next(entry for entry in entries if 'Chapter 6' in entry['title'])
        self.assertEqual(chapter_six['page'], 287)


class TestGoldenOutputInvariants(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(GOLDEN_PATH, encoding='utf-8') as handle:
            cls.golden = json.load(handle)

    def test_golden_schema_uses_page_index(self):
        nodes = list(walk_nodes(self.golden['structure']))
        self.assertGreater(len(nodes), 0)
        for node in nodes:
            self.assertIn('page_index', node)
            self.assertNotIn('start_index', node)
            self.assertNotIn('end_index', node)

    def test_golden_chapter_six_page(self):
        nodes = list(walk_nodes(self.golden['structure']))
        chapter_six_body = [
            node for node in nodes
            if node.get('page_index') == 28
            and 'interfaces' in (node.get('title') or '').lower()
        ]
        self.assertTrue(chapter_six_body)
        self.assertEqual(chapter_six_body[0]['page_index'], 28)

    def test_golden_node_count_reasonable(self):
        nodes = list(walk_nodes(self.golden['structure']))
        self.assertLess(len(nodes), 100)

    def test_golden_text_has_physical_index_tags(self):
        nodes = [node for node in walk_nodes(self.golden['structure']) if node.get('text')]
        self.assertTrue(nodes)
        for node in nodes:
            self.assertIn('<physical_index_', node['text'])


class TestFrontMatterGrouping(unittest.TestCase):
    def test_group_front_matter_structure(self):
        tree = [
            {'title': 'Preface', 'start_index': 1, 'end_index': 1},
            {'title': 'Chapter 1: An Introduction to Java', 'start_index': 7, 'end_index': 7},
            {'title': 'Chapter 6: Interfaces', 'start_index': 28, 'end_index': 90},
        ]
        page_list = [
            ('Preface text', 10),
            ('Core Java\nVolume I—Fundamentals', 10),
            ('', 1),
            ('', 1),
            ('', 1),
            ('Contents\nChapter 1', 20),
            ('Contents\nChapter 3', 20),
        ]
        toc_page_list = [5, 6]
        grouped = group_front_matter_structure(tree, toc_page_list, page_list, start_index=1)
        top_titles = [node['title'] for node in grouped]
        self.assertIn('Preface', top_titles)
        self.assertTrue(any('java' in title.lower() for title in top_titles))
        self.assertEqual(grouped[-1]['title'], 'Chapter 6: Interfaces')


if __name__ == '__main__':
    unittest.main()
