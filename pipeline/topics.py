from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import duckdb

TOPIC_RULES = {
    'Identity & fraud': ('identity', 'fraud', 'not mine', 'unauthorized'),
    'Credit reporting accuracy': ('credit report', 'incorrect information', 'score'),
    'Payments & fees': ('payment', 'fee', 'interest', 'charge'),
    'Debt collection': ('collection', 'collector', 'debt'),
    'Account access': ('close', 'cancel', 'access', 'blocked'),
}


def classify_topic(text: str | None) -> str:
    normalized = (text or '').casefold()
    for topic, terms in TOPIC_RULES.items():
        if any(term in normalized for term in terms):
            return topic
    return 'Other service issues'


def audit_topics(database: Path, output: Path, limit: int = 50_000) -> dict[str, object]:
    connection = duckdb.connect(str(database), read_only=True)
    rows = connection.execute(
        'select coalesce(narrative, issue) from complaints where coalesce(narrative, issue) is not null limit ?',
        [limit],
    ).fetchall()
    counts = Counter(classify_topic(row[0]) for row in rows)
    result = {
        'method': 'explainable_keyword_rules',
        'sample_rows': len(rows),
        'rules': {topic: list(terms) for topic, terms in TOPIC_RULES.items()},
        'distribution': dict(counts.most_common()),
        'limitation': 'Topics support triage and do not establish truth, causality, or regulatory findings.',
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    return result
