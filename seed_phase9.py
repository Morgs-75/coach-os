"""Seed Phase 9 test data: published meal plan + feedback row for test client Dan."""
import ctypes, ctypes.wintypes, json, urllib.request, ssl, sys

# ── Get PAT (UTF-8) ──────────────────────────────────────────────────────────
class CREDENTIAL(ctypes.Structure):
    _fields_ = [
        ("Flags", ctypes.wintypes.DWORD), ("Type", ctypes.wintypes.DWORD),
        ("TargetName", ctypes.wintypes.LPWSTR), ("Comment", ctypes.wintypes.LPWSTR),
        ("LastWritten", ctypes.wintypes.FILETIME), ("CredentialBlobSize", ctypes.wintypes.DWORD),
        ("CredentialBlob", ctypes.POINTER(ctypes.c_byte)), ("Persist", ctypes.wintypes.DWORD),
        ("AttributeCount", ctypes.wintypes.DWORD), ("Attributes", ctypes.c_void_p),
        ("TargetAlias", ctypes.wintypes.LPWSTR), ("UserName", ctypes.wintypes.LPWSTR),
    ]
advapi32 = ctypes.windll.advapi32
p_cred = ctypes.POINTER(CREDENTIAL)()
advapi32.CredReadW("Supabase CLI:supabase", 1, 0, ctypes.byref(p_cred))
blob = bytearray(p_cred.contents.CredentialBlobSize)
for i in range(p_cred.contents.CredentialBlobSize):
    blob[i] = p_cred.contents.CredentialBlob[i]
PAT = blob.decode("utf-8").strip()

# ── Query helper ─────────────────────────────────────────────────────────────
PROJECT = "ntqdmgvxirswnjlnwopq"
HOST = "api.supabase.com"
PATH = f"/v1/projects/{PROJECT}/database/query"

def query(sql, label=""):
    if label:
        sys.stdout.buffer.write(f"\n=== {label} ===\n".encode())
        sys.stdout.buffer.flush()
    body = json.dumps({"query": sql}).encode("utf-8")
    auth_val = f"Bearer {PAT}"
    header = (
        f"POST {PATH} HTTP/1.1\r\n"
        f"Host: {HOST}\r\n"
        f"Content-Type: application/json\r\n"
        f"Content-Length: {len(body)}\r\n"
        f"User-Agent: Mozilla/5.0\r\n"
        f"Authorization: {auth_val}\r\n"
        f"Connection: close\r\n"
        f"\r\n"
    ).encode("ascii")
    ctx = ssl.create_default_context()
    import socket
    raw = socket.create_connection((HOST, 443))
    sock = ctx.wrap_socket(raw, server_hostname=HOST)
    sock.sendall(header + body)
    resp_bytes = b""
    while True:
        chunk = sock.recv(4096)
        if not chunk:
            break
        resp_bytes += chunk
    sock.close()
    # Parse HTTP response
    header_end = resp_bytes.index(b"\r\n\r\n")
    status_line = resp_bytes[:resp_bytes.index(b"\r\n")].decode()
    status_code = int(status_line.split()[1])
    resp_body = resp_bytes[header_end+4:]
    # Handle chunked encoding
    if b"Transfer-Encoding: chunked" in resp_bytes[:header_end]:
        decoded = b""
        pos = 0
        while pos < len(resp_body):
            end = resp_body.index(b"\r\n", pos)
            size = int(resp_body[pos:end], 16)
            if size == 0:
                break
            decoded += resp_body[end+2:end+2+size]
            pos = end + 2 + size + 2
        resp_body = decoded
    result = json.loads(resp_body)
    sys.stdout.buffer.write(json.dumps(result, indent=2)[:600].encode() + b"\n")
    sys.stdout.buffer.flush()
    if status_code not in (200, 201):
        raise Exception(f"HTTP {status_code}: {resp_body.decode('utf-8', errors='replace')[:200]}")
    return result

# ── 1. Find test client ───────────────────────────────────────────────────────
rows = query(
    "SELECT id, full_name, org_id FROM clients WHERE portal_token = '5e34e856-2a34-4857-bbfa-f327233a6bdb' LIMIT 1",
    "Find test client"
)
if not rows:
    raise SystemExit("Test client not found")
CLIENT_ID = rows[0]["id"]
ORG_ID    = rows[0]["org_id"]
CLIENT_NAME = rows[0]["full_name"]

# ── 2. Pick food items from AFCD ─────────────────────────────────────────────
chickens = query(
    "SELECT id, food_name FROM food_items WHERE food_name ILIKE '%chicken%' AND energy_kcal IS NOT NULL LIMIT 1",
    "Find chicken food item"
)
eggs = query(
    "SELECT id, food_name FROM food_items WHERE food_name ILIKE '%egg%' AND energy_kcal IS NOT NULL LIMIT 1",
    "Find egg food item"
)
oats = query(
    "SELECT id, food_name FROM food_items WHERE food_name ILIKE '%oat%' AND energy_kcal IS NOT NULL LIMIT 1",
    "Find oat food item"
)
CHICKEN_ID = chickens[0]["id"] if chickens else None
EGG_ID     = eggs[0]["id"]     if eggs     else None
OAT_ID     = oats[0]["id"]     if oats     else None

# ── 3. Check for existing complete plan (has at least one component) ──────────
existing = query(
    f"""SELECT mp.id, mp.name, mp.version FROM meal_plans mp
        WHERE mp.client_id = '{CLIENT_ID}' AND mp.status = 'published'
        AND EXISTS (
            SELECT 1 FROM meal_plan_days md
            JOIN meal_plan_meals mm ON mm.day_id = md.id
            JOIN meal_plan_components mc ON mc.meal_id = mm.id
            WHERE md.plan_id = mp.id
        )
        LIMIT 1""",
    "Check existing complete plan"
)

# Clean up any incomplete plans (no components) for this client
query(
    f"""DELETE FROM meal_plans
        WHERE client_id = '{CLIENT_ID}'
        AND NOT EXISTS (
            SELECT 1 FROM meal_plan_days md
            JOIN meal_plan_meals mm ON mm.day_id = md.id
            JOIN meal_plan_components mc ON mc.meal_id = mm.id
            WHERE md.plan_id = meal_plans.id
        )""",
    "Clean up incomplete plans"
)

if existing:
    PLAN_ID = existing[0]["id"]
    sys.stdout.buffer.write(f"Reusing existing plan {PLAN_ID}\n".encode())
    sys.stdout.buffer.flush()
else:
    # ── 4. Create meal plan ───────────────────────────────────────────────────
    plan = query(f"""
        INSERT INTO meal_plans (org_id, client_id, name, status, version, start_date, end_date, published_at)
        VALUES (
            '{ORG_ID}', '{CLIENT_ID}',
            'Test 7-Day Plan', 'published', 1,
            CURRENT_DATE, CURRENT_DATE + 6,
            now()
        )
        RETURNING id
    """, "Create meal plan")
    PLAN_ID = plan[0]["id"]

    # ── 5. Create day 1 ───────────────────────────────────────────────────────
    day = query(f"""
        INSERT INTO meal_plan_days (plan_id, day_number, date)
        VALUES ('{PLAN_ID}', 1, CURRENT_DATE)
        RETURNING id
    """, "Create day 1")
    DAY_ID = day[0]["id"]

    # ── 6. Create breakfast meal ──────────────────────────────────────────────
    meal = query(f"""
        INSERT INTO meal_plan_meals (day_id, meal_type, title, sort_order)
        VALUES ('{DAY_ID}', 'breakfast', 'Eggs & Oats', 1)
        RETURNING id
    """, "Create breakfast meal")
    MEAL_ID = meal[0]["id"]

    # ── 7. Create components ──────────────────────────────────────────────────
    if EGG_ID:
        query(f"""
            INSERT INTO meal_plan_components (meal_id, food_item_id, qty_g, sort_order)
            VALUES ('{MEAL_ID}', '{EGG_ID}', 120, 1)
        """, "Add egg component")
    if OAT_ID:
        query(f"""
            INSERT INTO meal_plan_components (meal_id, food_item_id, qty_g, sort_order)
            VALUES ('{MEAL_ID}', '{OAT_ID}', 80, 2)
        """, "Add oat component")

    # ── 8. Create lunch meal ──────────────────────────────────────────────────
    lunch = query(f"""
        INSERT INTO meal_plan_meals (day_id, meal_type, title, sort_order)
        VALUES ('{DAY_ID}', 'lunch', 'Grilled Chicken', 2)
        RETURNING id
    """, "Create lunch meal")
    LUNCH_ID = lunch[0]["id"]
    if CHICKEN_ID:
        query(f"""
            INSERT INTO meal_plan_components (meal_id, food_item_id, qty_g, sort_order)
            VALUES ('{LUNCH_ID}', '{CHICKEN_ID}', 150, 1)
        """, "Add chicken component")

    # Create days 2-7 with same meals (minimal — just headings, no components)
    for d in range(2, 8):
        dr = query(f"""
            INSERT INTO meal_plan_days (plan_id, day_number, date)
            VALUES ('{PLAN_ID}', {d}, CURRENT_DATE + {d-1})
            RETURNING id
        """, f"Create day {d}")
        did = dr[0]["id"]
        query(f"""
            INSERT INTO meal_plan_meals (day_id, meal_type, sort_order)
            VALUES ('{did}', 'breakfast', 1), ('{did}', 'lunch', 2), ('{did}', 'dinner', 3)
        """, f"Create meals day {d}")

# ── 9. Get any meal from day 1 to attach feedback to ─────────────────────────
any_meal = query(f"""
    SELECT mm.id AS meal_id, mm.meal_type, mm.title
    FROM meal_plan_meals mm
    JOIN meal_plan_days md ON md.id = mm.day_id
    WHERE md.plan_id = '{PLAN_ID}' AND md.day_number = 1
    ORDER BY mm.sort_order
    LIMIT 1
""", "Find meal for feedback")

if not any_meal:
    raise SystemExit("No meals found in plan day 1")

MEAL_ID_FOR_FEEDBACK = any_meal[0]["meal_id"]

# ── 10. Check for existing feedback ──────────────────────────────────────────
existing_fb = query(
    f"SELECT id FROM meal_plan_feedback WHERE plan_id = '{PLAN_ID}' AND status = 'pending' LIMIT 1",
    "Check existing feedback"
)

if existing_fb:
    sys.stdout.buffer.write(b"Feedback row already exists - skipping insert\n")
    FB_ID = existing_fb[0]["id"]
else:
    # ── 11. Insert feedback row ───────────────────────────────────────────────
    fb = query(f"""
        INSERT INTO meal_plan_feedback (plan_id, meal_id, client_id, type, scope, comment, status)
        VALUES (
            '{PLAN_ID}', '{MEAL_ID_FOR_FEEDBACK}', '{CLIENT_ID}',
            'dislike', 'going_forward',
            'I really don''t like eggs in the morning, can we swap for something else?',
            'pending'
        )
        RETURNING id
    """, "Insert feedback row")
    FB_ID = fb[0]["id"]

sys.stdout.buffer.write(b"\n=== SEED COMPLETE ===\n")
sys.stdout.buffer.write(f"Plan ID:     {PLAN_ID}\n".encode())
sys.stdout.buffer.write(f"Feedback ID: {FB_ID}\n".encode())
sys.stdout.buffer.write(f"Client:      {CLIENT_NAME}\n".encode())
sys.stdout.buffer.write(b"\nPortal URL: http://localhost:3000/portal/5e34e856-2a34-4857-bbfa-f327233a6bdb\n")
sys.stdout.buffer.write(b"Coach URL:  http://localhost:3000/nutrition\n")
sys.stdout.buffer.flush()
