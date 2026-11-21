import os, re, requests

API = "https://api.github.com"

def headers(accept="application/vnd.github+json"):
    token = os.getenv("GITHUB_TOKEN")

    if not token:
        raise RuntimeError("GITHUB_TOKEN is missing from .env")

    return {
        "Authorization": f"Bearer {token}",
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28"
    }

def parse(pr_url):
    pattern = (
        r"^https://github\.com/"
        r"([A-Za-z0-9_.-]+)/"
        r"([A-Za-z0-9_.-]+)/pull/(\d+)/?$"
     )

    match = re.match(pattern, pr_url.strip())

    if not match:
        raise ValueError(
            "Expected https://github.com/OWNER/REPO/pull/NUMBER"
        )

    owner, repo, number = match.groups()
    return owner, repo, int(number)

def get_head_sha(owner, repo, number):
    url = f"{API}/repos/{owner}/{repo}/pulls/{number}"

    response = requests.get(
        url,
        headers=headers(),
        timeout=30
    )
    response.raise_for_status()

    return response.json()["head"]["sha"]

def get_diff(owner, repo, number):
    url = f"{API}/repos/{owner}/{repo}/pulls/{number}"

    response = requests.get(
        url,
        headers=headers("application/vnd.github.v3.diff"),
        timeout=30
    )
    response.raise_for_status()

    diff = response.text

    # Some GitHub responses may return JSON instead of diff text.
    if diff.lstrip().startswith("{"):
        raise RuntimeError(
            "GitHub returned JSON instead of a PR diff"
        )

    return diff

def post_comment(owner, repo, number, body):
    url = (
        f"{API}/repos/{owner}/{repo}/issues/"
        f"{number}/comments"
    )

    response = requests.post(
        url,
        headers=headers(),
        json={"body": body},
        timeout=30
    )
    response.raise_for_status()

    return response.json()


'''
def _h(extra = None):
    h = {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}"}
    h.update(extra or {})
    return h


def get_diff(owner, repo, n):
    r = requests.get(f"https://api.github.com/repos/{owner}/{repo}/pulls/{n}",
                     headers = _h({"Accept": "application/vnd.github.v3.diff"}))
    r.raise_for_status()
    return r.text

def get_head_sha(owner, repo, n):
    r = requests.get(f"https://api.github.com/repos/{owner}/{repo}/pulls/{n}", headers = _h())
    r.raise_for_status()
    return r.json()["head"]["sha"]

def post_comment(owner, repo, n, body):
    requests.post(f"https://api.github.com/repos/{owner}/{repo}/issues/{n}/comments", 
                  headers = _h(), json = {"body": body}).raise_for_status()
'''