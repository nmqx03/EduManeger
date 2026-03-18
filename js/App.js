// ─────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [classes, setClasses] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [passcodeUnlocked, setPasscodeUnlocked] = useState(false);
  const { hash, navigate } = useHashRouter();
  const { parts } = parseHash(hash);

  const page = parts[0] || "home";

  // Auth state listener + whitelist check
  const prevUidRef = useRef(null);

  useEffect(() => {
    const unsub = window.auth.onAuthStateChanged(async u => {
      if (u) {
        const allowed = await isEmailAllowed(u.email);
        if (!allowed) {
          await window.auth.signOut();
          setAccessDenied(true);
          setUser(null);
          localStorage.clear();
        } else {
          setAccessDenied(false);
          // Nếu đổi sang tài khoản khác → xóa localStorage cache cũ
          if (prevUidRef.current && prevUidRef.current !== u.uid) {
            localStorage.clear();
          }
          prevUidRef.current = u.uid;
          setUser(u);
        }
      } else {
        setUser(null);
        // Xóa localStorage khi đăng xuất
        localStorage.clear();
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Load classes when user logs in — chỉ từ Firestore, không dùng cache cũ
  useEffect(() => {
    if (!user) { setClasses([]); return; }
    setDataLoading(true);
    loadClassesFromDB(user.uid).then(data => {
      const list = (data && data.length > 0) ? data : [];
      setClasses(list);
      saveClasses(list);
      setDataLoading(false);
    }).catch(() => {
      setClasses([]);
      setDataLoading(false);
    });
  }, [user]);

  const setClassesAndSave = useCallback((updater) => {
    setClasses(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (user) saveClassesToDB(user.uid, next);
      else saveClasses(next);
      return next;
    });
  }, [user]);

  const handleLogout = () => {
    localStorage.clear();
    setPasscodeUnlocked(false);
    window.auth.signOut();
    navigate("#/");
  };

  if (authLoading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:16,background:"#eff6ff"}}>
      <div className="spin"><Icon name="database" size={36}/></div>
      <div style={{fontWeight:600,color:"#4f7fff",fontSize:16}}>Đang khởi động...</div>
    </div>
  );

  if (!user) return <LoginPage accessDenied={accessDenied} />;

  const isAdmin = user && user.email && user.email.toLowerCase() === SUPER_ADMIN;

  if (isAdmin) return (
    <div className="app-shell">
      <main className="main-content">
        <div className="header-bar">
          <div className="header-left">
            <span className="header-title">🔐 Quản Lý Tài Khoản</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {user.email}
            </div>
            <button className="header-home-btn" title="Đăng xuất" onClick={handleLogout}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
        <AdminPage user={user} />
      </main>
    </div>
  );

  const titles = {
    home:"Trang Chủ", attendance:"Điểm Danh", tuition:"Học Phí",
    students:"Học Sinh", data:"Dữ Liệu", timetable:"Thời Khóa Biểu",
    profile:"Hồ Sơ"
  };

  return (
    <div className="app-shell">
      <main className="main-content">
        <div className="header-bar">
          <div className="header-left">
            <button className="header-home-btn" onClick={() => navigate("#/")} title="Trang chủ">
              <Icon name="home" size={20} />
            </button>
            <span className="header-title">{titles[page] || "EduManagement"}</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button className="header-home-btn" style={{width:"auto",padding:"0 12px",fontSize:13,gap:6,fontWeight:500}} onClick={() => navigate("#/profile")}>
              👤 Hồ Sơ
            </button>
            <button className="header-home-btn" style={{width:"auto",padding:"0 12px",fontSize:13,gap:6,fontWeight:500}} onClick={() => navigate("#/data")}>
              <Icon name="database" size={18}/> Dữ Liệu
            </button>
            <div style={{width:1,height:20,background:"rgba(255,255,255,0.3)"}}/>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {user.displayName || user.email}
            </div>
            <button className="header-home-btn" title="Đăng xuất" onClick={handleLogout}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        {page === "home"       && <HomePage onNavigate={p => navigate(`#/${p}`)} />}
        {page === "attendance" && <AttendancePage classes={classes} setClasses={setClassesAndSave} navigate={navigate} hashParts={parts} user={user} passcodeUnlocked={passcodeUnlocked} setPasscodeUnlocked={setPasscodeUnlocked} />}
        {page === "tuition"    && <TuitionPage classes={classes} user={user} navigate={navigate} hashParts={parts} />}
        {page === "students"   && <StudentPage classes={classes} setClasses={setClassesAndSave} user={user} passcodeUnlocked={passcodeUnlocked} setPasscodeUnlocked={setPasscodeUnlocked} />}
        {page === "data"       && <DataPage classes={classes} setClasses={setClassesAndSave} user={user} />}
        {page === "timetable"  && <TimetablePage classes={classes} user={user} />}
        {page === "profile"    && <ProfilePage user={user} passcodeUnlocked={passcodeUnlocked} setPasscodeUnlocked={setPasscodeUnlocked} />}
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);