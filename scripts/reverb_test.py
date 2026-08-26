#!/usr/bin/env python3
"""Resolve place-reverb types from a toon config (no ffmpeg)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reverb  # noqa: E402


class ResolveReverbTest(unittest.TestCase):
    def test_book_default(self):
        self.assertEqual(reverb.resolve_reverb({'reverb': 'plaza'}), 'plaza')

    def test_page_overrides_book(self):
        self.assertEqual(
            reverb.resolve_reverb(
                {'reverb': 'plaza'},
                page={'reverb': 'plaza-deep'},
            ),
            'plaza-deep',
        )

    def test_word_overrides_page(self):
        self.assertEqual(
            reverb.resolve_reverb(
                {'reverb': 'plaza'},
                page={'reverb': 'plaza-deep'},
                word={'reverb': 'none'},
            ),
            None,
        )

    def test_cli_override_wins(self):
        self.assertEqual(
            reverb.resolve_reverb(
                {'reverb': 'plaza'},
                page={'reverb': 'plaza-deep'},
                override='none',
            ),
            None,
        )
        self.assertEqual(
            reverb.resolve_reverb(cfg=None, override='plaza'),
            'plaza',
        )

    def test_missing_is_dry(self):
        self.assertIsNone(reverb.resolve_reverb({}))
        self.assertIsNone(reverb.resolve_reverb(None))

    def test_unknown_type_errors(self):
        with self.assertRaises(ValueError) as ctx:
            reverb.resolve_reverb({'reverb': 'bathroom'})
        self.assertIn('plaza', str(ctx.exception))

    def test_loaded_types_have_filters(self):
        types = reverb.load_types()
        self.assertIn('plaza', types)
        self.assertIn('plaza-deep', types)
        for name, spec in types.items():
            self.assertTrue(spec.get('filter'), msg=name)


if __name__ == '__main__':
    unittest.main()
