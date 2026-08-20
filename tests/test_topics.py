from pipeline.topics import classify_topic


def test_topic_rules_are_explainable_and_deterministic() -> None:
    assert classify_topic('An unauthorized charge appeared') == 'Identity & fraud'
    assert classify_topic('The credit report has incorrect information') == 'Credit reporting accuracy'
    assert classify_topic('Collector keeps calling about debt') == 'Debt collection'
    assert classify_topic(None) == 'Other service issues'
