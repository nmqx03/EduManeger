// ─────────────────────────────────────────────────────────────────
// DATA MANAGEMENT PAGE (IMPORT/EXPORT)
// ─────────────────────────────────────────────────────────────────

function DataPage({ classes, setClasses, user }) {
    const [tab, setTab] = useState("export"); // 'export' | 'import'
    
    // Export State
    const [exportClassId, setExportClassId] = useState("");
    const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());
    const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);

    // Tính năm có dữ liệu từ lớp đã chọn
    const availableYears = useMemo(() => {
        if (!exportClassId) return [];
        const cls = classes.find(c => c.id === exportClassId);
        if (!cls) return [];
        const years = new Set();
        (cls.sessions || []).forEach(s => {
            if (s.date) years.add(s.date.slice(0, 4));
        });
        return [...years].sort().reverse();
    }, [exportClassId, classes]);

    // Tính tháng có dữ liệu từ lớp + năm đã chọn
    const availableMonths = useMemo(() => {
        if (!exportClassId || !exportYear) return [];
        const cls = classes.find(c => c.id === exportClassId);
        if (!cls) return [];
        const months = new Set();
        (cls.sessions || []).forEach(s => {
            if (s.date && s.date.startsWith(exportYear)) {
                months.add(parseInt(s.date.slice(5, 7)));
            }
        });
        return [...months].sort((a, b) => a - b);
    }, [exportClassId, exportYear, classes]);

    // Khi chọn lớp mới → reset về năm/tháng đầu tiên có dữ liệu
    const handleClassChange = (classId) => {
        setExportClassId(classId);
        if (!classId) return;
        const cls = classes.find(c => c.id === classId);
        if (!cls) return;
        const years = new Set();
        (cls.sessions || []).forEach(s => { if (s.date) years.add(s.date.slice(0, 4)); });
        const sortedYears = [...years].sort().reverse();
        if (sortedYears.length > 0) {
            const firstYear = sortedYears[0];
            setExportYear(firstYear);
            const months = new Set();
            (cls.sessions || []).forEach(s => {
                if (s.date && s.date.startsWith(firstYear)) months.add(parseInt(s.date.slice(5, 7)));
            });
            const sortedMonths = [...months].sort((a, b) => a - b);
            if (sortedMonths.length > 0) setExportMonth(sortedMonths[sortedMonths.length - 1]);
        }
    };

    // Khi chọn năm mới → reset tháng về tháng đầu có dữ liệu
    const handleYearChange = (year) => {
        setExportYear(year);
        const cls = classes.find(c => c.id === exportClassId);
        if (!cls) return;
        const months = new Set();
        (cls.sessions || []).forEach(s => {
            if (s.date && s.date.startsWith(year)) months.add(parseInt(s.date.slice(5, 7)));
        });
        const sortedMonths = [...months].sort((a, b) => a - b);
        if (sortedMonths.length > 0) setExportMonth(sortedMonths[sortedMonths.length - 1]);
    };

    // Import State
    const [importStep, setImportStep] = useState(0); // 0: Select Class, 1: Upload, 2: Map, 3: Success
    const [targetClassId, setTargetClassId] = useState("new");
    const [newClassName, setNewClassName] = useState("");
    const [wb, setWb] = useState(null);
    const [sheetName, setSheetName] = useState("");
    
    // Mapping config
    const [config, setConfig] = useState({
        nameRange: "AM5:AM34",
        priceRange: "AO5:AO34",
        hasAttendance: false,
        attendanceRange: "F5:AI34",
        attendanceDateRow: "F4:AI4",
        attendanceYear: new Date().getFullYear().toString(),
        attendanceMonth: (new Date().getMonth() + 1).toString(),
    });

    const handleExport = async () => {
        if (!exportClassId) { alert("Vui lòng chọn lớp!"); return; }
        const cls = classes.find(c => c.id === exportClassId);
        if (!cls) return;

        const y = parseInt(exportYear);
        const m = parseInt(exportMonth);

        // Filter sessions for the selected Month/Year
        const monthlySessions = (cls.sessions || []).filter(s => {
             if (!s.date) return false;
             const d = new Date(s.date);
             return d.getFullYear() === y && (d.getMonth() + 1) === m;
        });

        // Map day -> session
        const sessionMap = {};
        monthlySessions.forEach(ses => {
            const d = new Date(ses.date).getDate();
            sessionMap[d] = ses;
        });

        // Load Paid Data
        const paidData = user ? await loadPaidFromDB(user.uid, cls.id, exportYear, exportMonth) : loadPaid(cls.id, exportYear, exportMonth);

        // Pre-calculate totals for summary rows
        const studentStats = (cls.students || []).map(s => {
            let countMain = 0, countKem = 0;
            for (let day = 1; day <= 31; day++) {
                const ses = sessionMap[day];
                if (ses) {
                    if ((ses.attendance || []).includes(s.id)) countMain++;
                    else if ((ses.attendanceKem || []).includes(s.id)) countKem++;
                }
            }
            const priceMain = s.pricePerSession || 0;
            const priceKem = s.kemPrice || 0;
            const totalMain = countMain * priceMain;
            const totalKem = countKem * priceKem;
            const total = totalMain + totalKem;
            const isPaid = !!paidData[s.id];
            return { s, countMain, countKem, priceMain, priceKem, totalMain, totalKem, total, isPaid };
        });

        const totalNeeded = studentStats.reduce((a, x) => a + x.total, 0);
        const totalPaid   = studentStats.filter(x => x.isPaid).reduce((a, x) => a + x.total, 0);
        const totalUnpaid = totalNeeded - totalPaid;
        const countNeeded = studentStats.length;
        const countPaid   = studentStats.filter(x => x.isPaid).length;
        const countUnpaid = countNeeded - countPaid;

        // ── ROW 1: Summary (merge cells manually via styling)
        const summaryRow1 = [
            `Tổng số tiền cần thu: ${Number(totalNeeded).toLocaleString("vi-VN")}`,
            "", "",
            `Số học sinh cần đóng học: ${countNeeded}`,
            "", ...Array(31 + 9).fill("")
        ];
        const summaryRow2 = [
            `Tổng số tiền đã thu: ${Number(totalPaid).toLocaleString("vi-VN")}`,
            "", "",
            `Số học sinh đã đóng học: ${countPaid}`,
            "", ...Array(31 + 9).fill("")
        ];
        const summaryRow3 = [
            `Tổng số tiền chưa thu: ${Number(totalUnpaid).toLocaleString("vi-VN")}`,
            "", "",
            `Số học sinh chưa đóng học: ${countUnpaid}`,
            "", ...Array(31 + 9).fill("")
        ];

        // ── ROW 4: Header (số ngày 1-31)
        const header = [
            "STT", "Họ Tên", "Lớp",
            ...Array.from({length: 31}, (_, i) => i + 1),
            "Số buổi Chính", "HP Chính/Buổi", "Tiền Học Chính",
            "Số buổi Kèm", "HP Kèm/Buổi", "Tiền Học Kèm",
            "TỔNG HỌC PHÍ", "Trạng Thái", "Ghi Chú"
        ];

        // ── ROW 5: Actual dates under each day column
        const dateRow = ["", "", ""];
        for (let day = 1; day <= 31; day++) {
            const ses = sessionMap[day];
            if (ses) {
                // Format: DD/MM
                const d = new Date(ses.date);
                dateRow.push(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`);
            } else {
                dateRow.push("");
            }
        }
        dateRow.push("", "", "", "", "", "", "", "", "");

        // ── DATA ROWS
        const dataRows = studentStats.map(({ s, countMain, countKem, priceMain, priceKem, totalMain, totalKem, total, isPaid }, idx) => {
            const row = [idx + 1, s.name, cls.name];
            for (let day = 1; day <= 31; day++) {
                const ses = sessionMap[day];
                if (ses) {
                    const isMain = (ses.attendance || []).includes(s.id);
                    const isKem  = (ses.attendanceKem || []).includes(s.id);
                    row.push(isMain ? "x" : isKem ? "k" : "");
                } else {
                    row.push("");
                }
            }
            row.push(countMain, priceMain, totalMain);
            row.push(countKem, priceKem, totalKem);
            row.push(total, isPaid ? "Đã thu" : "Chưa thu", "");
            return row;
        });

        // ── ATTENDANCE COUNT ROW (bottom)
        const countRow = ["", "Số học sinh đi học:", ""];
        for (let day = 1; day <= 31; day++) {
            const ses = sessionMap[day];
            if (ses) {
                const cnt = ((ses.attendance || []).length) + ((ses.attendanceKem || []).length);
                countRow.push(cnt);
            } else {
                countRow.push(0);
            }
        }
        countRow.push("", "", "", "", "", "", "", "", "");

        const allRows = [summaryRow1, summaryRow2, summaryRow3, header, dateRow, ...dataRows, countRow];
        const ws = XLSX.utils.aoa_to_sheet(allRows);

        // Column widths
        const wscols = [
            {wch: 5}, {wch: 25}, {wch: 10},
            ...Array(31).fill({wch: 4}),
            {wch: 14}, {wch: 15}, {wch: 15},
            {wch: 12}, {wch: 15}, {wch: 15},
            {wch: 16}, {wch: 12}, {wch: 20}
        ];
        ws['!cols'] = wscols;

        // Merge summary cells (A1:C1, A2:C2, A3:C3 and D1:E1, D2:E2, D3:E3)
        ws['!merges'] = [
            {s:{r:0,c:0}, e:{r:0,c:2}}, {s:{r:0,c:3}, e:{r:0,c:7}},
            {s:{r:1,c:0}, e:{r:1,c:2}}, {s:{r:1,c:3}, e:{r:1,c:7}},
            {s:{r:2,c:0}, e:{r:2,c:2}}, {s:{r:2,c:3}, e:{r:2,c:7}},
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `T${m}-${y}`);
        XLSX.writeFile(wb, `HocPhi_${cls.name}_T${m}_${y}.xlsx`);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                setWb(workbook);
                setSheetName(workbook.SheetNames[0]);
                setImportStep(2);
            } catch (err) {
                alert("Lỗi đọc file Excel: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const decodeRange = (rangeStr) => {
        try { return XLSX.utils.decode_range(rangeStr); } catch { return null; }
    };

    const getCellValue = (ws, r, c) => {
        const cell = ws[XLSX.utils.encode_cell({r, c})];
        return cell ? cell.v : undefined;
    };

    // Chuẩn hoá ngày từ nhiều định dạng về YYYY-MM-DD
    const parseImportDate = (val, fallbackYear, fallbackMonth) => {
        if (!val) return null;
        const s = String(val).trim();
        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // DD/MM/YYYY
        const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
        // DD/MM
        const dm = s.match(/^(\d{1,2})\/(\d{1,2})$/);
        if (dm) return `${fallbackYear}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
        // Chỉ là số ngày (1-31)
        const dayOnly = s.match(/^(\d{1,2})$/);
        if (dayOnly) return `${fallbackYear}-${String(fallbackMonth).padStart(2,'0')}-${dayOnly[1].padStart(2,'0')}`;
        // Excel serial date — dùng UTC để tránh lệch timezone
        if (!isNaN(Number(s)) && Number(s) > 1000) {
            const d = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
            if (!isNaN(d.getTime())) {
                return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
            }
        }
        return null;
    };

    const handleProcessImport = () => {
        if (!wb) return;
        const ws = wb.Sheets[sheetName];
        if (!ws) { alert("Không tìm thấy sheet: " + sheetName); return; }

        const rName = decodeRange(config.nameRange);
        if (!rName) { alert("❌ Vùng Họ Tên không hợp lệ: \"" + config.nameRange + "\""); return; }

        const rPrice = config.priceRange ? decodeRange(config.priceRange) : null;
        if (config.priceRange && !rPrice) { alert("❌ Vùng Học Phí không hợp lệ: \"" + config.priceRange + "\""); return; }

        let rAtt = null, sessionDates = [];
        if (config.hasAttendance) {
            if (!config.attendanceRange) { alert("❌ Vui lòng nhập vùng điểm danh"); return; }
            rAtt = decodeRange(config.attendanceRange);
            if (!rAtt) { alert("❌ Vùng điểm danh không hợp lệ: \"" + config.attendanceRange + "\""); return; }

            const fy = config.attendanceYear || new Date().getFullYear().toString();
            const fm = config.attendanceMonth || (new Date().getMonth()+1).toString();

            if (!config.attendanceDateRow) { alert("❌ Vui lòng nhập hàng chứa ngày (bắt buộc)"); return; }

            if (config.attendanceDateRow) {
                const rDate = decodeRange(config.attendanceDateRow);
                if (!rDate) { alert("❌ Vùng ngày không hợp lệ: \"" + config.attendanceDateRow + "\""); return; }

                // Kiểm tra số cột khớp
                const attCols = rAtt.e.c - rAtt.s.c + 1;
                const dateCols = rDate.e.c - rDate.s.c + 1;
                if (attCols !== dateCols) {
                    alert(`❌ Số cột không khớp:\n• Vùng điểm danh: ${attCols} cột\n• Vùng ngày: ${dateCols} cột`);
                    return;
                }

                for (let c = rAtt.s.c; c <= rAtt.e.c; c++) {
                    const colOffset = c - rAtt.s.c;
                    const dateC = rDate.s.c + colOffset;
                    const v = getCellValue(ws, rDate.s.r, dateC);
                    sessionDates.push(parseImportDate(v, fy, fm));
                }

                const hasAnyDate = sessionDates.some(Boolean);
                if (!hasAnyDate) {
                    alert("❌ Không đọc được ngày nào từ vùng \"" + config.attendanceDateRow + "\"\nChấp nhận: DD/MM/YYYY, DD/MM, số ngày, Excel date serial");
                    return;
                }
            } else {
                // Không có hàng ngày → tạo ngày liên tiếp theo tháng/năm
                const totalCols = rAtt.e.c - rAtt.s.c + 1;
                for (let i = 0; i < totalCols; i++) {
                    sessionDates.push(`${fy}-${String(fm).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`);
                }
            }
        }

        // Lấy tên lớp để tạo mã học viên
        const targetCls = targetClassId === "new" ? null : classes.find(c => c.id === targetClassId);
        const clsName = targetClassId === "new" ? (newClassName || "").trim() : (targetCls?.name || "");
        const clsNameShort = clsName.replace(/\s+/g, '');
        // Số học viên hiện có trong lớp (để tính STT tiếp theo)
        const existingCount = targetCls ? (targetCls.students || []).length : 0;

        const newStudents = [];
        const studentRowMap = [];

        for (let r = rName.s.r; r <= rName.e.r; r++) {
            const nameVal = getCellValue(ws, r, rName.s.c);
            if (!nameVal || nameVal === 0 || String(nameVal).trim() === "0") continue;
            const nameStr = String(nameVal).trim();
            if (!nameStr || nameStr.toLowerCase().includes("tổng")) continue;
            const sid = Date.now().toString() + Math.random().toString().slice(2,5) + newStudents.length;
            let price = 0;
            if (rPrice && r >= rPrice.s.r && r <= rPrice.e.r) {
                const pVal = getCellValue(ws, r, rPrice.s.c);
                if (pVal) price = parseInt(String(pVal).replace(/\D/g, "")) || 0;
            }
            // Mã học viên: STT 2 chữ số + tên lớp, VD: 01E2019
            const stt = existingCount + newStudents.length + 1;
            const studentCode = String(stt).padStart(2, '0') + clsNameShort;
            newStudents.push({ id: sid, studentCode, name: nameStr, pricePerSession: price, hasKem: false, kemPrice: 0, days: [] });
            studentRowMap.push(r);
        }

        if (newStudents.length === 0) { alert("Không tìm thấy học sinh nào trong vùng đã chọn."); return; }

        let importedSessions = [];
        if (rAtt && sessionDates.length > 0) {
            const sessionMap = {};
            for (let ci = 0; ci < sessionDates.length; ci++) {
                const date = sessionDates[ci];
                if (!date) continue;
                const colIdx = rAtt.s.c + ci;
                for (let si = 0; si < newStudents.length; si++) {
                    const rowIdx = studentRowMap[si];
                    if (rowIdx < rAtt.s.r || rowIdx > rAtt.e.r) continue;
                    const val = getCellValue(ws, rowIdx, colIdx);
                    const valStr = String(val ?? "").trim().toLowerCase();
                    const present = val !== undefined && val !== null && valStr !== "" && valStr !== "0" && valStr !== "false";
                    if (present) {
                        if (!sessionMap[date]) {
                            sessionMap[date] = { id: Date.now().toString() + ci, date, attendance: [], attendanceKem: [] };
                        }
                        sessionMap[date].attendance.push(newStudents[si].id);
                    }
                }
            }
            importedSessions = Object.values(sessionMap).sort((a,b) => a.date.localeCompare(b.date));
        }

        let updatedClasses, finalClassName = "", sessionCount = importedSessions.length, mergeSkipped = 0;

        if (targetClassId === "new") {
            if (!newClassName.trim()) { alert("Vui lòng nhập tên lớp mới"); return; }
            finalClassName = newClassName.trim();
            const newClass = { id: Date.now().toString(), name: finalClassName, students: newStudents, sessions: importedSessions };
            updatedClasses = [...classes, newClass];
        } else {
            updatedClasses = classes.map(cls => {
                if (cls.id !== targetClassId) return cls;
                finalClassName = cls.name;
                const clsShort = cls.name.replace(/\s+/g, '');

                // Bỏ học sinh trùng tên
                const existingNames = new Set((cls.students || []).map(s => s.name.trim().toLowerCase()));
                const toAdd = [];
                const idRemap = {};

                newStudents.forEach(ns => {
                    if (existingNames.has(ns.name.trim().toLowerCase())) {
                        // Trùng → remap id sang học sinh cũ
                        const existing = (cls.students || []).find(s => s.name.trim().toLowerCase() === ns.name.trim().toLowerCase());
                        if (existing) idRemap[ns.id] = existing.id;
                        mergeSkipped++;
                    } else {
                        // Mới → cấp mã tự động
                        const stt = (cls.students || []).length + toAdd.length + 1;
                        const studentCode = String(stt).padStart(2, '0') + clsShort;
                        toAdd.push({ ...ns, studentCode });
                        idRemap[ns.id] = ns.id;
                    }
                });

                const mergedStudents = [...(cls.students || []), ...toAdd];
                const existingDates = new Set((cls.sessions || []).map(s => s.date));
                const existingSessions = [...(cls.sessions || [])];

                for (const ns of importedSessions) {
                    const remapId = (aid) => {
                        const newStu = newStudents.find(s => s.id === aid);
                        return newStu ? (idRemap[newStu.id] || aid) : aid;
                    };
                    const remappedAtt = ns.attendance.map(remapId);
                    const remappedKem = (ns.attendanceKem || []).map(remapId);

                    if (existingDates.has(ns.date)) {
                        const exist = existingSessions.find(s => s.date === ns.date);
                        if (exist) {
                            const newIds = new Set(toAdd.map(s => s.id));
                            exist.attendance = [...new Set([...exist.attendance, ...remappedAtt.filter(id => newIds.has(id))])];
                            exist.attendanceKem = [...new Set([...(exist.attendanceKem || []), ...remappedKem.filter(id => newIds.has(id))])];
                        }
                    } else {
                        existingSessions.push({ ...ns, attendance: remappedAtt, attendanceKem: remappedKem });
                    }
                }
                existingSessions.sort((a,b) => a.date.localeCompare(b.date));
                return { ...cls, students: mergedStudents, sessions: existingSessions };
            });
        }

        setClasses(updatedClasses);
        const sessMsg = sessionCount > 0 ? `, ${sessionCount} buổi điểm danh` : "";
        const skipMsg = mergeSkipped > 0 ? `\n(Bỏ qua ${mergeSkipped} học sinh trùng tên)` : "";
        alert(`✅ Đã nhập thành công ${newStudents.length - mergeSkipped} học sinh${sessMsg} vào lớp "${finalClassName}"!${skipMsg}`);
        setImportStep(0);
        setWb(null);
    };

        const handleExportPDF = async () => {
        if (!exportClassId) { alert("Vui lòng chọn lớp!"); return; }
        if (!window.jspdf) { alert("Thư viện jsPDF chưa tải xong!"); return; }
        if (!window.html2canvas) { alert("Thư viện html2canvas chưa tải xong!"); return; }
        const cls = classes.find(c => c.id === exportClassId);
        if (!cls) return;
        const y = parseInt(exportYear), m = parseInt(exportMonth);
        const monthlySessions = (cls.sessions||[]).filter(s => {
            if (!s.date) return false;
            const d = new Date(s.date);
            return d.getFullYear()===y && (d.getMonth()+1)===m;
        }).sort((a,b) => a.date.localeCompare(b.date));
        const sessionMap = {};
        monthlySessions.forEach(ses => { sessionMap[new Date(ses.date).getDate()] = ses; });
        const paidData = user ? await loadPaidFromDB(user.uid, cls.id, exportYear, exportMonth) : loadPaid(cls.id, exportYear, exportMonth);
        const activeDays = [];
        for (let d=1;d<=31;d++) { if (sessionMap[d]) activeDays.push(d); }
        const studentStats = (cls.students||[]).map(s => {
            let cm=0,ck=0;
            activeDays.forEach(d => {
                const ses=sessionMap[d];
                if ((ses.attendance||[]).includes(s.id)) cm++;
                else if ((ses.attendanceKem||[]).includes(s.id)) ck++;
            });
            const tm=cm*(s.pricePerSession||0), tk=ck*(s.kemPrice||0);
            return {s,cm,ck,tm,tk,total:tm+tk,isPaid:!!paidData[s.id]};
        });
        const totalNeeded=studentStats.reduce((a,x)=>a+x.total,0);
        const totalPaid=studentStats.filter(x=>x.isPaid).reduce((a,x)=>a+x.total,0);
        const totalUnpaid=totalNeeded-totalPaid;
        const thS = 'style="background:#4f7fff;color:#fff;font-weight:700;font-size:11px;padding:5px 4px;border:1px solid #93c5fd;text-align:center;"';
        const dayH = activeDays.map(d => {
            const dt=new Date(sessionMap[d].date);
            return '<th '+thS+'>'+d+'<br/><span style="font-weight:400;font-size:9px;">'+String(dt.getDate()).padStart(2,'0')+'/'+String(dt.getMonth()+1).padStart(2,'0')+'</span></th>';
        }).join("");
        const rows = studentStats.map(({s,cm,ck,tm,tk,total,isPaid},idx) => {
            const days = activeDays.map(d => {
                const ses=sessionMap[d];
                const isM=(ses.attendance||[]).includes(s.id), isK=(ses.attendanceKem||[]).includes(s.id);
                const v=isM?"x":isK?"k":"", c=isM?"#16a34a":isK?"#6d28d9":"#ccc";
                return '<td style="font-size:11px;padding:3px;border:1px solid #bfdbfe;text-align:center;color:'+c+';font-weight:bold;">'+v+'</td>';
            }).join("");
            const bg=idx%2===0?"#fff":"#f5f9ff", pc=isPaid?"#16a34a":"#ef4444";
            return '<tr style="background:'+bg+';">'+
                '<td style="font-size:11px;padding:3px;border:1px solid #bfdbfe;text-align:center;">'+( idx+1)+'</td>'+
                '<td style="font-size:11px;padding:3px;border:1px solid #bfdbfe;text-align:left;font-weight:600;">'+s.name+'</td>'+
                days+
                '<td style="font-size:11px;padding:3px;border:1px solid #bfdbfe;text-align:center;">'+cm+'</td>'+
                '<td style="font-size:11px;padding:3px;border:1px solid #bfdbfe;text-align:center;">'+Number(s.pricePerSession||0).toLocaleString("vi-VN")+'</td>'+
                '<td style="font-size:11px;padding:3px;border:1px solid #bfdbfe;text-align:center;font-weight:700;">'+Number(tm).toLocaleString("vi-VN")+'</td>'+
                '<td style="font-size:11px;padding:3px;border:1px solid #bfdbfe;text-align:center;">'+( s.hasKem?ck:"-")+'</td>'+
                '<td style="font-size:11px;padding:3px;border:1px solid #bfdbfe;text-align:center;">'+( s.hasKem?Number(s.kemPrice||0).toLocaleString("vi-VN"):"-")+'</td>'+
                '<td style="font-size:11px;padding:3px;border:1px solid #bfdbfe;text-align:center;font-weight:700;">'+( s.hasKem?Number(tk).toLocaleString("vi-VN"):"-")+'</td>'+
                '<td style="font-size:11px;padding:3px;border:1px solid #bfdbfe;text-align:center;font-weight:800;color:#2563eb;">'+Number(total).toLocaleString("vi-VN")+'</td>'+
                '<td style="font-size:11px;padding:3px;border:1px solid #bfdbfe;text-align:center;color:'+pc+';font-weight:600;">'+( isPaid?"Đã thu":"Chưa thu")+'</td>'+
                '</tr>';
        }).join("");
        const countCells = activeDays.map(d => {
            const ses=sessionMap[d], cnt=((ses.attendance||[]).length)+((ses.attendanceKem||[]).length);
            return '<td style="font-size:11px;padding:3px;border:1px solid #1a6b38;text-align:center;color:#fff;font-weight:700;">'+cnt+'</td>';
        }).join("");
        const html = '<div style="font-family:Arial,sans-serif;padding:16px;background:#fff;display:inline-block;">'+
            '<div style="font-size:15px;font-weight:800;color:#2563eb;margin-bottom:8px;">Bảng Điểm Danh – Lớp '+cls.name+' – Tháng '+m+'/'+y+'</div>'+
            '<div style="font-size:11px;background:#eff6ff;padding:6px 10px;border-radius:6px;border:1px solid #bfdbfe;margin-bottom:10px;">'+
            'Tổng cần thu: <b>'+Number(totalNeeded).toLocaleString("vi-VN")+' đ</b> &nbsp;|&nbsp; '+
            '<span style="color:#16a34a;">Đã thu: <b>'+Number(totalPaid).toLocaleString("vi-VN")+' đ</b> ('+studentStats.filter(x=>x.isPaid).length+' HS)</span> &nbsp;|&nbsp; '+
            '<span style="color:#ef4444;">Chưa thu: <b>'+Number(totalUnpaid).toLocaleString("vi-VN")+' đ</b> ('+studentStats.filter(x=>!x.isPaid).length+' HS)</span></div>'+
            '<table style="border-collapse:collapse;">'+
            '<thead><tr>'+
            '<th '+thS+'>STT</th><th '+thS+' style="text-align:left;padding:5px 8px;">Họ Và Tên</th>'+
            dayH+
            '<th '+thS+'>Số buổi<br/>Chính</th><th '+thS+'>HP/Buổi<br/>Chính</th><th '+thS+'>Tổng HP<br/>Chính</th>'+
            '<th '+thS+'>Số buổi<br/>Kèm</th><th '+thS+'>HP/Buổi<br/>Kèm</th><th '+thS+'>Tổng HP<br/>Kèm</th>'+
            '<th '+thS+'>TỔNG HP</th><th '+thS+'>Trạng Thái</th>'+
            '</tr></thead><tbody>'+rows+
            '<tr style="background:#22873a;">'+
            '<td style="padding:3px;border:1px solid #1a6b38;"></td>'+
            '<td style="font-size:11px;padding:3px;border:1px solid #1a6b38;color:#fff;font-weight:700;text-align:left;">Số HS đi học:</td>'+
            countCells+
            '<td colspan="8" style="border:1px solid #1a6b38;"></td>'+
            '</tr></tbody></table></div>';
        const wrap = document.createElement("div");
        wrap.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;background:#fff;";
        wrap.innerHTML = html;
        document.body.appendChild(wrap);
        const target = wrap.querySelector("div");
        window.html2canvas(target, {scale:2, useCORS:true, backgroundColor:"#fff", logging:false})
            .then(canvas => {
                try { document.body.removeChild(wrap); } catch(e){}
                const {jsPDF} = window.jspdf;
                const pw = (canvas.width/2)*0.264583, ph = (canvas.height/2)*0.264583;
                const doc = new jsPDF({orientation:'landscape', unit:'mm', format:[pw+10,ph+10]});
                doc.addImage(canvas.toDataURL("image/png"),"PNG",5,5,pw,ph);
                doc.save("DiemDanh_"+cls.name+"_T"+m+"_"+y+".pdf");
            })
            .catch(err => {
                try { document.body.removeChild(wrap); } catch(e){}
                alert("Lỗi xuất PDF: " + err.message);
            });
    };


    return (
        <div className="page-content">
             <div className="page-topbar">
                 <div className="page-topbar-title">Quản Lý Dữ Liệu</div>
             </div>

             <div className="data-tabs">
                 <button className={`data-tab-btn ${tab === 'pdf' ? 'active' : ''}`} onClick={() => setTab('pdf')}>
                    <Icon name="download" /> Xuất PDF
                 </button>
                 <button className={`data-tab-btn ${tab === 'export' ? 'active' : ''}`} onClick={() => setTab('export')}>
                    <Icon name="download" /> Xuất Excel
                 </button>
                 <button className={`data-tab-btn ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>
                    <Icon name="upload" /> Nhập Excel
                 </button>
             </div>

             {tab === 'pdf' && (
                 <div className="data-container">
                     <div className="form-card">
                         <h3>Xuất PDF bảng điểm danh</h3>
                         <p style={{color:'#6b7280', fontSize:14, marginBottom:16}}>Xuất bảng điểm danh + học phí sang file PDF (khổ A3 ngang).</p>

                         <label className="form-label">Chọn lớp</label>
                         <select className="form-input" value={exportClassId} onChange={e => handleClassChange(e.target.value)}>
                             <option value="">-- Chọn lớp --</option>
                             {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>

                         {exportClassId && availableYears.length === 0 && (
                             <div style={{marginTop:12,padding:"10px 14px",background:"#fef9c3",border:"1px solid #fde68a",borderRadius:8,fontSize:13,color:"#92400e"}}>
                                 ⚠️ Lớp này chưa có dữ liệu điểm danh nào
                             </div>
                         )}

                         {availableYears.length > 0 && (
                             <div className="form-grid-2" style={{marginTop: 15}}>
                                 <div>
                                    <label className="form-label">Năm</label>
                                    <select className="form-input" value={exportYear} onChange={e => handleYearChange(e.target.value)}>
                                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                 </div>
                                 <div>
                                    <label className="form-label">Tháng</label>
                                    <select className="form-input" value={exportMonth} onChange={e => setExportMonth(parseInt(e.target.value))}>
                                        {availableMonths.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                                    </select>
                                 </div>
                             </div>
                         )}

                         <button className="btn-save" style={{marginTop: 20, width: '100%', height: 44, fontSize: 15, background:'linear-gradient(135deg,#ef4444,#dc2626)'}}
                             onClick={handleExportPDF} disabled={!exportClassId || availableYears.length === 0}>
                             📄 Tải xuống (.pdf)
                         </button>
                     </div>
                 </div>
             )}

             {tab === 'export' && (
                 <div className="data-container">
                     <div className="form-card">
                         <h3>Xuất dữ liệu lớp học</h3>
                         <p style={{color:'#6b7280', fontSize:14, marginBottom:16}}>Chọn lớp và tháng để xuất bảng điểm danh chi tiết.</p>
                         
                         <label className="form-label">Chọn lớp</label>
                         <select className="form-input" value={exportClassId} onChange={e => handleClassChange(e.target.value)}>
                             <option value="">-- Chọn lớp --</option>
                             {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                         </select>

                         {exportClassId && availableYears.length === 0 && (
                             <div style={{marginTop:12,padding:"10px 14px",background:"#fef9c3",border:"1px solid #fde68a",borderRadius:8,fontSize:13,color:"#92400e"}}>
                                 ⚠️ Lớp này chưa có dữ liệu điểm danh nào
                             </div>
                         )}

                         {availableYears.length > 0 && (
                             <div className="form-grid-2" style={{marginTop: 15}}>
                                 <div>
                                    <label className="form-label">Năm</label>
                                    <select className="form-input" value={exportYear} onChange={e => handleYearChange(e.target.value)}>
                                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                 </div>
                                 <div>
                                    <label className="form-label">Tháng</label>
                                    <select className="form-input" value={exportMonth} onChange={e => setExportMonth(parseInt(e.target.value))}>
                                        {availableMonths.map(m => <option key={m} value={m}>Tháng {m}</option>)}
                                    </select>
                                 </div>
                             </div>
                         )}

                         <button style={{marginTop: 20, width: '100%', height: 44, fontSize: 15, background:'linear-gradient(135deg,#217346,#1a5c38)', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer', opacity: (!exportClassId || availableYears.length === 0) ? 0.5 : 1}}
                             onClick={handleExport} disabled={!exportClassId || availableYears.length === 0}>
                             Tải xuống (.xlsx)
                         </button>
                     </div>
                 </div>
             )}

             {tab === 'import' && (
                 <div className="data-container">
                     {importStep === 0 && (
                         <div className="form-card">
                            <h3>Bước 1: Chọn nơi lưu dữ liệu</h3>
                            <label className="form-label">Nhập vào lớp</label>
                            <select className="form-input" value={targetClassId} onChange={e => setTargetClassId(e.target.value)}>
                                <option value="new">+ Tạo lớp mới</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            
                            {targetClassId === "new" && (
                                <div style={{marginTop: 10}}>
                                    <label className="form-label">Tên lớp mới</label>
                                    <input className="form-input" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="VD: Toán 9A" />
                                </div>
                            )}

                            <button className="btn-save" style={{marginTop: 20, width: '100%'}} onClick={() => {
                                if (targetClassId === 'new' && !newClassName) { alert("Nhập tên lớp!"); return; }
                                setImportStep(1);
                            }}>Tiếp tục</button>
                         </div>
                     )}

                     {importStep === 1 && (
                         <div className="form-card">
                             <h3>Bước 2: Chọn file Excel</h3>
                             <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="form-input" style={{padding: 10}} />
                             <button className="btn-back" style={{marginTop: 10}} onClick={() => setImportStep(0)}>Quay lại</button>
                         </div>
                     )}

                     {importStep === 2 && (
                         <div className="form-card" style={{maxWidth: 600}}>
                             <h3>Bước 3: Cấu hình vùng dữ liệu</h3>
                             <p style={{fontSize:13, color:'#6b7280', marginBottom:15}}>Nhập toạ độ vùng (VD: B5:B20) trong Sheet: <b>{sheetName}</b></p>

                             <div className="form-grid-2">
                                <div>
                                    <label className="form-label">Vùng Họ Tên <span style={{color:'#ef4444'}}>*</span></label>
                                    <input className="form-input" value={config.nameRange} onChange={e => setConfig({...config, nameRange: e.target.value})} placeholder="VD: AM5:AM34" />
                                </div>
                             </div>
                             <div className="form-grid-2" style={{marginTop:12}}>
                                <div>
                                    <label className="form-label">Vùng Học Phí (Tuỳ chọn)</label>
                                    <input className="form-input" value={config.priceRange} onChange={e => setConfig({...config, priceRange: e.target.value})} placeholder="VD: AO5:AO34" />
                                </div>
                             </div>

                             {/* Toggle điểm danh */}
                             <div style={{marginTop:18, padding:"12px 14px", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8}}>
                                 <label style={{display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontWeight:600, fontSize:14, color:"#1e40af"}}>
                                     <input type="checkbox" checked={config.hasAttendance}
                                         onChange={e => setConfig({...config, hasAttendance: e.target.checked})}
                                         style={{width:16, height:16, accentColor:"#4f7fff"}} />
                                     📋 Nhập kèm dữ liệu điểm danh
                                 </label>
                                 <div style={{fontSize:12, color:"#6b7280", marginTop:5, marginLeft:26}}>
                                     Mỗi cột trong vùng điểm danh = 1 buổi học. Ô có giá trị (x, 1, ✓...) = có mặt.
                                 </div>
                             </div>

                             {config.hasAttendance && (
                                 <div style={{marginTop:14, padding:"14px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, display:"flex", flexDirection:"column", gap:12}}>
                                     <div>
                                         <label className="form-label">Vùng điểm danh <span style={{color:'#ef4444'}}>*</span></label>
                                         <input className="form-input" value={config.attendanceRange}
                                             onChange={e => setConfig({...config, attendanceRange: e.target.value})}
                                             placeholder="VD: F4:AI34" />
                                         <div style={{fontSize:12, color:"#9ca3af", marginTop:4}}>Số hàng phải khớp với vùng Họ Tên</div>
                                     </div>
                                     <div>
                                         <label className="form-label">Hàng chứa ngày <span style={{color:'#ef4444'}}>*</span></label>
                                         <input className="form-input" value={config.attendanceDateRow}
                                             onChange={e => setConfig({...config, attendanceDateRow: e.target.value})}
                                             placeholder="VD: F4:AI4"
                                             style={{borderColor: config.hasAttendance && !config.attendanceDateRow ? '#ef4444' : undefined}} />
                                         <div style={{fontSize:12, color:"#9ca3af", marginTop:4}}>Chấp nhận: DD/MM/YYYY, DD/MM, số ngày, Excel date</div>
                                         {config.hasAttendance && !config.attendanceDateRow && (
                                             <div style={{fontSize:12, color:'#ef4444', marginTop:4, fontWeight:600}}>⚠️ Bắt buộc phải nhập hàng chứa ngày</div>
                                         )}
                                     </div>
                                 </div>
                             )}

                             <div style={{display:'flex', gap:10, marginTop:20}}>
                                <button className="btn-back" onClick={() => { setWb(null); setImportStep(1); }}>Chọn file khác</button>
                                <button className="btn-save" style={{flex:1,
                                    opacity: (config.hasAttendance && (!config.attendanceRange || !config.attendanceDateRow)) ? 0.5 : 1,
                                    cursor: (config.hasAttendance && (!config.attendanceRange || !config.attendanceDateRow)) ? 'not-allowed' : 'pointer'
                                }} onClick={handleProcessImport}
                                    disabled={config.hasAttendance && (!config.attendanceRange || !config.attendanceDateRow)}>
                                    Xử lý &amp; Nhập
                                </button>
                             </div>
                         </div>
                     )}
                 </div>
             )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────