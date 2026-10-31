"""Create a reproducible public CFPB laboratory sample; never modify the source CSV."""
from __future__ import annotations

import argparse
import ast
import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build_sample(source: Path, size: int = 200) -> dict:
    strata = defaultdict(list)
    with source.open(encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            if row['Consumer complaint narrative'].strip():
                strata[(row['Product'], row['Timely response?'])].append(row)
    eligible = sum(map(len, strata.values()))
    for rows in strata.values():
        rows.sort(key=lambda r: hashlib.sha256(('clearline-lab-v1:' + r['Complaint ID']).encode()).hexdigest())
    selected = []
    while len(selected) < size and any(strata.values()):
        for key in sorted(strata):
            if strata[key] and len(selected) < size:
                selected.append(strata[key].pop())
    tree = ast.parse((ROOT / 'pipeline/topics.py').read_text(encoding='utf-8'))
    rules = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'TOPIC_RULES' for t in n.targets))
    records = []
    for row in sorted(selected, key=lambda r: int(r['Complaint ID'])):
        narrative = row['Consumer complaint narrative']
        baseline = next((label for label, terms in rules.items() if any(term in narrative.casefold() for term in terms)), 'Other service issues')
        records.append({
            'id': row['Complaint ID'], 'receivedAt': row['Date received'],
            'sentAt': row['Date sent to company'], 'product': row['Product'],
            'issue': row['Issue'], 'company': row['Company'], 'state': row['State'],
            'timely': {'Yes': True, 'No': False}.get(row['Timely response?']),
            'companyResponse': row['Company response to consumer'],
            'monetaryRelief': row['Company response to consumer'] == 'Closed with monetary relief',
            'narrative': narrative, 'baseline': baseline,
            'sourceUrl': f"https://www.consumerfinance.gov/data-research/consumer-complaints/search/detail/{row['Complaint ID']}",
        })
    digest = hashlib.sha256(json.dumps(records, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    with source.open('rb') as handle:
        source_digest = hashlib.file_digest(handle, 'sha256').hexdigest()
    return {'meta': {
        'version': f'cfpb-200-{digest[:16]}', 'recordsSha256': digest,
        'source': 'CFPB Consumer Complaint Database', 'license': 'CC0',
        'sourceUrl': 'https://www.consumerfinance.gov/data-research/consumer-complaints/',
        'exportUrl': 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?date_received_min=2025-01-01&date_received_max=2025-01-07&format=csv',
        'sourceFile': source.name, 'sourceSha256': source_digest,
        'eligibleNarratives': eligible, 'sampleSize': len(records),
        'selection': 'Round robin across product × timely-response strata; within each stratum SHA256(clearline-lab-v1:ID) descending. Deliberately enriches rare products and untimely exceptions; not representative.',
        'period': {'min': min(r['receivedAt'][:10] for r in records), 'max': max(r['receivedAt'][:10] for r in records)},
        'products': dict(Counter(r['product'] for r in records)),
        'timely': dict(Counter(str(r['timely']) for r in records)),
        'baselineRules': {k: list(v) for k, v in rules.items()},
    }, 'rows': records}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    result = build_sample(args.source)
    target = ROOT / 'public/data/narrative-lab.json'
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result['meta'], indent=2))
