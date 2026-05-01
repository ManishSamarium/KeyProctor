import streamlit as st
from datetime import datetime

def inject_global_css():
    st.markdown("""
    <style>
    /* ── STREAMLIT CHROME REMOVAL ── */
    #MainMenu { visibility: hidden !important; }
    footer { visibility: hidden !important; }
    header { visibility: hidden !important; }
    [data-testid="stToolbar"] { display: none !important; }
    .stDeployButton { display: none !important; }
    [data-testid="stDecoration"] { display: none !important; }

    /* ── REMOVE ALL DEFAULT PADDING ── */
    .main .block-container {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        max-width: 100% !important;
    }

    /* ── REMOVE STREAMLIT DEFAULT SIDEBAR ── */
    section[data-testid="stSidebar"] {
        display: none !important;
    }

    /* ── FULL HEIGHT APP ── */
    html, body, [data-testid="stAppViewContainer"] {
        height: 100% !important;
        overflow: hidden !important;
    }
    [data-testid="stAppViewContainer"] {
        display: flex !important;
        flex-direction: column !important;
    }

    /* ── FONT ── */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    html, body, * {
        font-family: 'Inter', sans-serif !important;
        box-sizing: border-box !important;
    }

    /* ── STREAMLIT ELEMENT RESETS ── */
    .stButton > button {
        border-radius: 10px !important;
        font-weight: 500 !important;
        font-size: 14px !important;
        transition: all 0.2s ease !important;
        border: none !important;
    }
    .stTextInput > div > div > input {
        border-radius: 10px !important;
        border: 1.5px solid #e2e8f0 !important;
        font-size: 14px !important;
        padding: 10px 14px !important;
        transition: border-color 0.2s !important;
    }
    .stTextInput > div > div > input:focus {
        border-color: #6366f1 !important;
        box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important;
        outline: none !important;
    }
    .stSelectbox > div > div {
        border-radius: 10px !important;
        border: 1.5px solid #e2e8f0 !important;
    }
    .stTextArea > div > div > textarea {
        border-radius: 10px !important;
        border: 1.5px solid #e2e8f0 !important;
        font-size: 14px !important;
    }
    .stProgress > div > div > div > div {
        background: linear-gradient(90deg, #6366f1, #8b5cf6) !important;
        border-radius: 99px !important;
    }
    [data-testid="stMetricValue"] {
        font-size: 28px !important;
        font-weight: 600 !important;
        color: #0f172a !important;
    }
    .stTabs [data-baseweb="tab-list"] {
        background: #f1f5f9 !important;
        border-radius: 12px !important;
        padding: 4px !important;
        gap: 2px !important;
        border: none !important;
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 8px !important;
        font-weight: 500 !important;
        font-size: 14px !important;
        padding: 8px 18px !important;
        color: #64748b !important;
        background: transparent !important;
    }
    .stTabs [aria-selected="true"] {
        background: white !important;
        color: #6366f1 !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.1) !important;
    }
    div[data-testid="stVerticalBlock"] { gap: 0 !important; }
    div[data-testid="stHorizontalBlock"] { gap: 0 !important; align-items: stretch !important; }
    </style>
    """, unsafe_allow_html=True)


def show_login_page_layout(role_callback, form_callback):
    # Step 1: inject page-specific CSS
    st.markdown("""
    <style>
    /* Make body truly full height with no scroll */
    [data-testid="stAppViewContainer"] {
        background: linear-gradient(135deg, #0f0c29 0%, #302b63 55%, #24243e 100%) !important;
        overflow: hidden !important;
    }
    /* Animated background orbs */
    .tp-orb {
        position: fixed; border-radius: 50%;
        filter: blur(72px); opacity: 0.4; z-index: 0; pointer-events: none;
    }
    .tp-orb-1 {
        width: 520px; height: 520px; background: #6366f1;
        top: -160px; left: -120px;
        animation: orbFloat1 9s ease-in-out infinite;
    }
    .tp-orb-2 {
        width: 420px; height: 420px; background: #8b5cf6;
        bottom: -120px; right: -80px;
        animation: orbFloat2 11s ease-in-out infinite;
    }
    .tp-orb-3 {
        width: 280px; height: 280px; background: #06b6d4;
        top: 45%; left: 55%;
        animation: orbFloat3 13s ease-in-out infinite;
    }
    @keyframes orbFloat1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(35px,-25px)} }
    @keyframes orbFloat2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,35px)} }
    @keyframes orbFloat3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(25px,20px)} }

    /* Center wrapper */
    .tp-login-wrapper {
        position: fixed; inset: 0; z-index: 1;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
    }
    /* Card */
    .tp-login-card {
        width: 100%; max-width: 420px;
        background: rgba(255,255,255,0.08);
        backdrop-filter: blur(28px);
        -webkit-backdrop-filter: blur(28px);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 24px;
        padding: 44px 40px;
        box-shadow: 0 32px 72px rgba(0,0,0,0.55);
        position: relative; z-index: 2;
    }
    /* Override Streamlit inputs for dark login card */
    .tp-login-card .stTextInput > div > div > input {
        background: rgba(255,255,255,0.09) !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        color: white !important;
        border-radius: 12px !important;
        padding: 12px 16px !important;
        font-size: 14px !important;
    }
    .tp-login-card .stTextInput > div > div > input::placeholder { color: rgba(255,255,255,0.4) !important; }
    .tp-login-card .stTextInput > div > div > input:focus {
        border-color: #818cf8 !important;
        box-shadow: 0 0 0 3px rgba(99,102,241,0.25) !important;
        background: rgba(255,255,255,0.13) !important;
    }
    .tp-login-card label, .tp-login-card .stSelectbox label {
        color: rgba(255,255,255,0.75) !important;
        font-size: 13px !important;
        font-weight: 500 !important;
    }
    .tp-login-card .stSelectbox > div > div {
        background: rgba(255,255,255,0.09) !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        color: white !important;
        border-radius: 12px !important;
    }
    /* Primary button inside card */
    .tp-login-card .stButton > button {
        background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
        color: white !important; font-weight: 600 !important;
        height: 50px !important; width: 100% !important;
        font-size: 15px !important; border-radius: 12px !important;
        box-shadow: 0 4px 16px rgba(99,102,241,0.4) !important;
        margin-top: 8px !important;
    }
    .tp-login-card .stButton > button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 28px rgba(99,102,241,0.55) !important;
    }
    </style>

    <!-- Background orbs -->
    <div class="tp-orb tp-orb-1"></div>
    <div class="tp-orb tp-orb-2"></div>
    <div class="tp-orb tp-orb-3"></div>
    """, unsafe_allow_html=True)

    # The actual card — use a centered column trick
    _, card_col, _ = st.columns([1, 1.4, 1])

    with card_col:
        st.markdown("""
        <div class="tp-login-card">
        <div style="text-align:center;margin-bottom:28px">
          <svg width="52" height="52" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 3L7 9.5v13.8C7 33.2 14.6 43 24 45.5 33.4 43 41 33.2 41 23.3V9.5L24 3z" fill="#6366f1"/>
            <path d="M17 24l5 5 9-10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div style="color:white;font-size:26px;font-weight:700;margin-top:10px;letter-spacing:-0.3px">TypeProctor</div>
          <div style="color:rgba(255,255,255,0.42);font-size:12.5px;margin-top:5px;line-height:1.5">
            Behavioural exam integrity<br>powered by keystroke dynamics
          </div>
        </div>
        </div>
        """, unsafe_allow_html=True)

        if not st.session_state.get('login_role'):
            role_callback()
        else:
            form_callback()


def render_faculty_layout(content_fn):
    """Wraps any faculty page content with the sidebar + main area layout."""
    st.markdown("""
    <style>
    [data-testid="stAppViewContainer"] {
        background: #f8fafc !important;
    }
    /* Left column = sidebar */
    div[data-testid="stHorizontalBlock"] > div:first-child {
        background: #0f172a !important;
        min-height: 100vh !important;
        padding: 0 !important;
        position: sticky !important;
        top: 0 !important;
    }
    /* Sidebar buttons */
    div[data-testid="stHorizontalBlock"] > div:first-child .stButton > button {
        background: transparent !important;
        color: #94a3b8 !important;
        text-align: left !important;
        width: 100% !important;
        height: 44px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-weight: 400 !important;
        border: none !important;
        padding: 0 12px !important;
        justify-content: flex-start !important;
    }
    div[data-testid="stHorizontalBlock"] > div:first-child .stButton > button:hover {
        background: rgba(255,255,255,0.07) !important;
        color: white !important;
    }
    /* Right column = content area */
    div[data-testid="stHorizontalBlock"] > div:last-child {
        background: #f8fafc !important;
        padding: 28px 32px !important;
        min-height: 100vh !important;
        overflow-y: auto !important;
    }
    </style>
    """, unsafe_allow_html=True)

    sidebar_col, content_col = st.columns([1, 4.5])

    with sidebar_col:
        st.markdown("""
        <div style="padding:24px 16px 20px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <div style="display:flex;align-items:center;gap:8px">
            <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
              <path d="M24 3L7 9.5v13.8C7 33.2 14.6 43 24 45.5 33.4 43 41 33.2 41 23.3V9.5L24 3z" fill="#6366f1"/>
              <path d="M17 24l5 5 9-10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span style="color:white;font-weight:600;font-size:15px">TypeProctor</span>
          </div>
          <div style="margin-top:14px">
            <div style="color:white;font-size:13px;font-weight:500">{name}</div>
            <div style="background:rgba(99,102,241,0.25);color:#a5b4fc;font-size:11px;
              padding:2px 8px;border-radius:99px;display:inline-block;margin-top:4px">{course}</div>
          </div>
        </div>
        """.format(
            name=st.session_state.get('full_name','Faculty'),
            course=st.session_state.get('course_name','')
        ), unsafe_allow_html=True)

        st.markdown("<div style='padding:8px 8px'>", unsafe_allow_html=True)

        nav = [('overview','📊  Overview'), ('exams','📝  Exams'),
               ('lab','🧪  Code Lab'), ('reports','📋  Reports')]
        for page_id, label in nav:
            is_active = st.session_state.get('page') == page_id
            if is_active:
                st.markdown(f"""
                <div style="background:rgba(99,102,241,0.18);border-left:3px solid #6366f1;
                  color:#a5b4fc;padding:10px 12px;border-radius:0 8px 8px 0;
                  font-size:14px;font-weight:500;margin-bottom:2px">{label}</div>
                """, unsafe_allow_html=True)
            else:
                if st.button(label, key=f"nav_{page_id}", use_container_width=True):
                    st.session_state.page = page_id
                    st.rerun()

        st.markdown("</div>", unsafe_allow_html=True)
        st.markdown("<div style='height:40px'></div>", unsafe_allow_html=True)
        if st.button("🚪  Logout", key="faculty_logout", use_container_width=True):
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()

    with content_col:
        content_fn()


def render_student_navbar():
    """Fixed top navbar for student pages."""
    first_name = st.session_state.get('full_name','Student').split()[0]
    initials = ''.join(w[0].upper() for w in st.session_state.get('full_name','S').split()[:2])
    hour = datetime.now().hour
    greeting = 'Good morning' if hour < 12 else 'Good afternoon' if hour < 17 else 'Good evening'

    st.markdown(f"""
    <div style="
      background:#0f172a; padding:14px 32px;
      border-bottom:1px solid #1e293b;
      box-shadow:0 1px 4px rgba(0,0,0,0.2);
      display:flex; align-items:center; justify-content:space-between;
      position:sticky; top:0; z-index:100;
    ">
      <div style="display:flex;align-items:center;gap:10px">
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
          <path d="M24 3L7 9.5v13.8C7 33.2 14.6 43 24 45.5 33.4 43 41 33.2 41 23.3V9.5L24 3z" fill="#6366f1"/>
          <path d="M17 24l5 5 9-10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span style="font-weight:600;font-size:16px;color:white">TypeProctor</span>
      </div>
      <div style="color:#94a3b8;font-size:14px">{greeting}, <b style="color:white">{first_name}</b> 👋</div>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="background:#ede9fe;color:#6d28d9;font-size:11px;font-weight:600;
          padding:3px 10px;border-radius:99px">{st.session_state.get('enrollment_no','')}</span>
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);
          color:white;font-weight:600;font-size:13px;display:flex;align-items:center;
          justify-content:center">{initials}</div>
      </div>
    </div>
    """, unsafe_allow_html=True)


def render_student_layout(content_fn):
    """Navbar + content wrapper for all student pages."""
    st.markdown("""
    <style>
    [data-testid="stAppViewContainer"] { background: #0e1117 !important; }
    /* Content area padding */
    div[data-testid="stVerticalBlock"] > div { padding: 0 !important; }
    </style>
    """, unsafe_allow_html=True)
    render_student_navbar()
    _, content, _ = st.columns([0.05, 11, 0.05])
    with content:
        st.markdown("<div style='padding:28px 0'>", unsafe_allow_html=True)
        content_fn()
        st.markdown("</div>", unsafe_allow_html=True)


def metric_card(value, label, icon, color="#6366f1", bg="#ede9fe"):
    """Render a single metric card."""
    return f"""
    <div style="background:white;border-radius:16px;padding:20px 22px;
      border:1px solid #f1f5f9;box-shadow:0 2px 8px rgba(0,0,0,0.05);height:100%">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:13px;color:#64748b;font-weight:500">{label}</div>
        <div style="width:36px;height:36px;border-radius:10px;background:{bg};
          display:flex;align-items:center;justify-content:center;font-size:18px">{icon}</div>
      </div>
      <div style="font-size:30px;font-weight:700;color:#0f172a">{value}</div>
    </div>
    """


def course_card(faculty_name, course_name, initials, exam_count, lab_count, color="#6366f1"):
    """Render a course card for student dashboard."""
    return f"""
    <div style="background:white;border-radius:16px;padding:0;
      border:1px solid #f1f5f9;box-shadow:0 2px 8px rgba(0,0,0,0.05);
      overflow:hidden;transition:all 0.2s;cursor:pointer;height:100%">
      <div style="height:4px;background:linear-gradient(90deg,{color},{color}99)"></div>
      <div style="padding:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div style="width:42px;height:42px;border-radius:12px;
            background:linear-gradient(135deg,{color},{color}bb);
            color:white;font-weight:700;font-size:16px;
            display:flex;align-items:center;justify-content:center">{initials}</div>
          <div>
            <div style="font-weight:600;font-size:15px;color:#0f172a">{faculty_name}</div>
            <div style="font-size:13px;color:#64748b;margin-top:1px">{course_name}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <span style="background:#ede9fe;color:#6d28d9;font-size:11px;font-weight:600;
            padding:3px 10px;border-radius:99px">📝 {exam_count} Exams</span>
          <span style="background:#d1fae5;color:#065f46;font-size:11px;font-weight:600;
            padding:3px 10px;border-radius:99px">🧪 {lab_count} Labs</span>
        </div>
      </div>
    </div>
    """


def section_header(title, subtitle="", action_label="", action_key=""):
    """Consistent section header above content blocks."""
    st.markdown(f"""
    <div style="display:flex;align-items:flex-end;justify-content:space-between;
      margin-bottom:16px;margin-top:8px">
      <div>
        <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0">{title}</h2>
        {f'<p style="font-size:13px;color:#64748b;margin:4px 0 0">{subtitle}</p>' if subtitle else ''}
      </div>
    </div>
    """, unsafe_allow_html=True)


def status_badge(text, status):
    """status: verified | warning | flagged | active | ended | easy | medium | hard"""
    colors = {
        'verified': ('#dcfce7','#166534'),
        'warning':  ('#fef9c3','#854d0e'),
        'flagged':  ('#fee2e2','#991b1b'),
        'active':   ('#dbeafe','#1e40af'),
        'ended':    ('#f1f5f9','#475569'),
        'easy':     ('#d1fae5','#065f46'),
        'medium':   ('#fef3c7','#92400e'),
        'hard':     ('#fee2e2','#991b1b'),
    }
    bg, fg = colors.get(status.lower(), ('#f1f5f9','#475569'))
    return f"""<span style="background:{bg};color:{fg};font-size:11px;font-weight:600;
      padding:3px 10px;border-radius:99px;display:inline-block">{text}</span>"""


def render_metrics_row(metrics):
    """metrics = list of (value, label, icon, color, bg) tuples."""
    cols = st.columns(len(metrics))
    for col, (value, label, icon, color, bg) in zip(cols, metrics):
        with col:
            st.markdown(metric_card(value, label, icon, color, bg),
              unsafe_allow_html=True)


def render_exam_portal_layout(header_data, q_fn, auth_fn):
    st.markdown("""
    <style>
    /* Exam portal overrides */
    [data-testid="stAppViewContainer"] { background: #0f172a !important; overflow: hidden !important; }
    .main .block-container { padding: 0 !important; height: 100vh !important; overflow: hidden !important; }
    /* Left question panel scrolls, right auth panel fixed */
    .exam-questions-panel {
        height: calc(100vh - 60px); overflow-y: auto; padding: 24px 28px;
        background: #f8fafc;
        scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;
    }
    .exam-auth-panel {
        height: calc(100vh - 60px); overflow-y: auto; padding: 20px;
        background: white; border-left: 1px solid #f1f5f9;
    }
    /* Question card */
    .exam-q-card {
        background: white; border-radius: 14px; padding: 20px 22px;
        border: 1px solid #e2e8f0; margin-bottom: 16px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    /* Answer textarea override for exam */
    .exam-questions-panel .stTextArea > div > div > textarea {
        background: #f8fafc !important; border: 1.5px solid #e2e8f0 !important;
        border-radius: 10px !important; font-size: 14px !important;
        line-height: 1.7 !important; color: #0f172a !important;
        min-height: 120px !important;
    }
    .exam-questions-panel .stTextArea > div > div > textarea:focus {
        border-color: #6366f1 !important;
        box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important;
    }
    </style>
    """, unsafe_allow_html=True)

    # Sticky exam header
    st.markdown(f"""
    <div style="background:#0f172a;padding:12px 28px;display:flex;
      align-items:center;justify-content:space-between;
      box-shadow:0 2px 12px rgba(0,0,0,0.4)">
      <div style="color:white;font-weight:600;font-size:15px">{header_data.get('title','Exam')}</div>
      <div id="exam-countdown" style="font-family:'JetBrains Mono',monospace;
        font-size:22px;font-weight:600;color:#a5b4fc">{header_data.get('timer', '00:00')}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <div id="auth-dot" style="width:9px;height:9px;border-radius:50%;
          background:{header_data.get('auth_color', '#22c55e')};animation:authpulse 2s infinite"></div>
        <span style="color:#94a3b8;font-size:13px">Monitoring active</span>
      </div>
    </div>
    <style>
    @keyframes authpulse {{0%,100%{{box-shadow:0 0 0 0 rgba({header_data.get('auth_rgb', '34,197,94')},0.5)}}
      50%{{box-shadow:0 0 0 6px rgba({header_data.get('auth_rgb', '34,197,94')},0)}}}}
    </style>
    """, unsafe_allow_html=True)

    # Split layout: questions (60%) + auth panel (40%)
    q_col, auth_col = st.columns([3, 2])

    with q_col:
        st.markdown('<div class="exam-questions-panel">', unsafe_allow_html=True)
        q_fn()
        st.markdown('</div>', unsafe_allow_html=True)

    with auth_col:
        st.markdown('<div class="exam-auth-panel">', unsafe_allow_html=True)
        auth_fn()
        st.markdown('</div>', unsafe_allow_html=True)


def render_step_indicator(current_step, steps):
    """Render step progress indicator inside registration card."""
    dots = ""
    for i, label in enumerate(steps, 1):
        if i < current_step:
            dot_style = "background:#6366f1;color:white"
            label_style = "color:#6366f1;font-weight:500"
        elif i == current_step:
            dot_style = "background:#6366f1;color:white;box-shadow:0 0 0 4px rgba(99,102,241,0.2)"
            label_style = "color:#0f172a;font-weight:600"
        else:
            dot_style = "background:#e2e8f0;color:#94a3b8"
            label_style = "color:#94a3b8"

        dots += f"""
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="{dot_style};width:28px;height:28px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-size:12px;font-weight:600;transition:all 0.3s">{i if i >= current_step else '✓'}</div>
          <span style="{label_style};font-size:11px">{label}</span>
        </div>
        """
        if i < len(steps):
            line_color = "#6366f1" if i < current_step else "#e2e8f0"
            dots += f"<div style='flex:1;height:2px;background:{line_color};margin-top:13px;transition:background 0.3s'></div>"

    st.markdown(f"""
    <div style="display:flex;align-items:flex-start;gap:0;margin-bottom:28px;padding:0 8px">
      {dots}
    </div>
    """, unsafe_allow_html=True)


def spacer(h=16):
    """Add vertical space without blank lines."""
    st.markdown(f"<div style='height:{h}px'></div>", unsafe_allow_html=True)


def divider():
    """Styled divider line."""
    st.markdown("<hr style='border:none;border-top:1px solid #f1f5f9;margin:20px 0'>",
      unsafe_allow_html=True)
