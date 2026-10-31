"""Check released source evidence against the optional, read-only original CFPB CSV."""
import csv
import hashlib
import json
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_sample_provenance_and_indicator_definition():
    sample = json.loads((ROOT / 'public/data/narrative-lab.json').read_text(encoding='utf-8'))
    assert len(sample['rows']) == sample['meta']['sampleSize'] == 200
    assert len({r['id'] for r in sample['rows']}) == 200
    assert sample['meta']['source'] == 'CFPB Consumer Complaint Database'
    assert sample['meta']['license'] == 'CC0'
    assert 'not representative' in sample['meta']['selection']
    for row in sample['rows']:
        assert row['monetaryRelief'] == (row['companyResponse'] == 'Closed with monetary relief')
        assert row['narrative'].strip()


@pytest.mark.skipif(not os.getenv('CLEARLINE_LAB_SOURCE'), reason='Set CLEARLINE_LAB_SOURCE to the original public export for read-only source reconciliation')
def test_all_200_released_narratives_match_original_public_export_exactly():
    source = Path(os.environ['CLEARLINE_LAB_SOURCE'])
    sample = json.loads((ROOT / 'public/data/narrative-lab.json').read_text(encoding='utf-8'))
    with source.open('rb') as handle:
        assert hashlib.file_digest(handle, 'sha256').hexdigest() == sample['meta']['sourceSha256']
    ids = {row['id'] for row in sample['rows']}
    with source.open(encoding='utf-8-sig', newline='') as handle:
        original = {r['Complaint ID']: r for r in csv.DictReader(handle) if r['Complaint ID'] in ids}
    assert len(original) == 200
    fields = {'narrative': 'Consumer complaint narrative', 'receivedAt': 'Date received', 'sentAt': 'Date sent to company', 'product': 'Product', 'issue': 'Issue', 'company': 'Company', 'state': 'State', 'companyResponse': 'Company response to consumer'}
    for row in sample['rows']:
        raw = original[row['id']]
        for app_field, source_field in fields.items():
            assert row[app_field] == raw[source_field]
        assert row['timely'] == {'Yes': True, 'No': False}.get(raw['Timely response?'])
