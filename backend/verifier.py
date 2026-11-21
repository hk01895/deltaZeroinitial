def verify(pr_id, head_sha, diff, requirements):
    for r in requirements:
        return {"verdicts": [
            {"req_id":r["req_id"], 
             "verdict": "partial", 
             "confidence": 0.5,
             "evidence_lines": [], 
             "suggested_diff": "", 
             "suggested_test": "",
             "model_used": "fast", 
             "latency_ms": 0}
        ]}