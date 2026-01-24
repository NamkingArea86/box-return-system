// ==========================================
// 1. การตั้งค่าระบบ (Configuration)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDRYTht-6h5QDqFTGO6sr44TfuvDfApAPc",
    authDomain: "box-return-system.firebaseapp.com",
    projectId: "box-return-system",
    storageBucket: "box-return-system.firebasestorage.app",
    messagingSenderId: "272291754420",
    appId: "1:272291754420:web:9ee1c794acbe190309c2e1",
    measurementId: "G-8PX3LBXM3L"
};

// เริ่มต้นการเชื่อมต่อ Firebase (ตรวจสอบก่อนเพื่อไม่ให้ประกาศซ้ำ)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ==========================================
// 2. ระบบจัดการหน้าจอ (Window Load)
// ==========================================
window.onload = async function() {
    const userPhone = localStorage.getItem('userPhone');
    const path = window.location.pathname.toLowerCase();
    
    // ตรวจสอบการเข้าสู่ระบบ
    if (!userPhone && !path.includes('login.html') && !path.includes('register.html')) {
        window.location.replace('login.html');
        return;
    }
    
    if (userPhone) {
        await loadUserData(); 
        if (path.includes('history.html')) {
            fetchHistoryFromFirebase(userPhone); 
        }
    }
};

// ==========================================
// 3. ฟังก์ชันหลักของระบบ (Main Functions)
// ==========================================

// --- เข้าสู่ระบบ ---
async function performLogin() {
    const phone = document.getElementById('loginPhone').value.trim();
    const pass = document.getElementById('loginPassword').value;

    if (!phone || !pass) {
        alert("กรุณากรอกเบอร์โทรศัพท์และรหัสผ่าน");
        return;
    }

    try {
        const userDoc = await db.collection("users").doc(phone).get();
        if (userDoc.exists) {
            if (userDoc.data().password === pass) {
                localStorage.setItem('userPhone', phone);
                alert("เข้าสู่ระบบสำเร็จ!");
                window.location.replace('index.html');
            } else {
                alert("รหัสผ่านไม่ถูกต้อง");
            }
        } else {
            alert("ไม่พบเบอร์โทรศัพท์นี้ในระบบ");
        }
    } catch (e) { alert("Error: " + e.message); }
}

// --- ลงทะเบียนใหม่ ---
async function performRegister() {
    try {
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : "";
        };

        const name = getVal('regName');
        const studentId = getVal('regStudentId');
        const faculty = getVal('regFaculty');
        const year = getVal('regYear');
        const phone = getVal('regPhone');
        const pass = document.getElementById('regPassword').value;
        const confirmPass = document.getElementById('regConfirmPassword').value;

        if (!name || !studentId || !faculty || !year || !phone || !pass || !confirmPass) {
            alert("กรุณากรอกข้อมูลให้ครบทุกช่อง");
            return;
        }

        if (studentId.length !== 10) {
            alert("รหัสนักศึกษาต้องมี 10 หลักเท่านั้น");
            return;
        }

        const passRegex = /^(?=.*[a-zA-Z])(?=.*[0-9]).{1,10}$/;
        if (!passRegex.test(pass)) {
            alert("รหัสผ่านต้องมีทั้งภาษาอังกฤษและตัวเลข (ไม่เกิน 10 หลัก)");
            return;
        }

        if (pass !== confirmPass) {
            alert("รหัสผ่านไม่ตรงกัน");
            return;
        }

        await db.collection("users").doc(phone).set({
            name, studentId, faculty, year, phone,
            password: pass, points: 0, returnCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        localStorage.setItem('userPhone', phone);
        alert("ลงทะเบียนสำเร็จ!");
        window.location.replace('index.html');
    } catch (error) { alert("เกิดข้อผิดพลาด: " + error.message); }
}

// --- ยืมกล่อง ---
async function borrowBox() {
    const boxId = document.getElementById('boxInput').value;
    const shopName = document.getElementById('shopSelect').value;
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !shopName) { 
        alert("กรุณากรอกหมายเลขกล่องและเลือกสถานที่ยืม"); 
        return; 
    }

    try {
        await db.collection("transactions").add({
            boxId: boxId,
            shopName: shopName,
            userPhone: userPhone,
            type: 'borrow',
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection("users").doc(userPhone).update({
            points: firebase.firestore.FieldValue.increment(1)
        });

        Swal.fire({
            icon: 'success',      
            title: 'ลงทะเบียนยืมกล่องสำเร็จ 🎉',
            html: `
                <div style="text-align:left;font-size:16px;line-height:1.8">
                    📦 <b>เลขกล่อง:</b> ${boxId}<br>
                    📍 <b>จุดคืน:</b> ${shopName}<br>
                    ⭐ <b>ได้รับ:</b> 1 แต้ม
                </div>
            `,
            background: '#ffffff',
            color: '#1B5E20',
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#4CAF50'
        }).then(() => {
            window.location.replace('history.html');
        });
    } 
    catch (e) {
        console.error(e);
        alert("เกิดข้อผิดพลาด: " + e.message);
    }
}

// --- คืนกล่องแบบสแกน QR ---
async function returnBoxWithQR(scannedText) {
    const boxId = document.getElementById('boxInputReturn').value;
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId) {
        alert("กรุณาระบุหมายเลขกล่องก่อนสแกน");
        location.reload();
        return;
    }

    if (!scannedText.startsWith("BOX-")) {
        alert("QR Code ไม่ถูกต้อง!");
        location.reload();
        return;
    }

    const cleanLocation = scannedText.replace("BOX-", "");

    try {
        await db.collection("transactions").add({
            boxId: boxId,
            shopName: cleanLocation,
            userPhone: userPhone,
            type: 'return',
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection("users").doc(userPhone).update({ 
            points: firebase.firestore.FieldValue.increment(1),
            returnCount: firebase.firestore.FieldValue.increment(1)
        });

        Swal.fire({
            icon: 'success',
            title: 'ลงทะเบียนคืนกล่องสำเร็จ 🎉',
            html: `
                <div style="text-align:left;font-size:16px;line-height:1.8">
                    📦 <b>เลขกล่อง:</b> ${boxId}<br>
                    📍 <b>จุดคืน:</b> ${cleanLocation}<br>
                    ⭐ <b>ได้รับ:</b> 1 แต้ม
                </div>
            `,
            background: '#ffffff',
            color: '#1B5E20',
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#4CAF50'
        }).then(() => {
            window.location.replace('history.html');
        });
    } catch (e) { alert("เกิดข้อผิดพลาด: " + e.message); }
}

// --- ดึงประวัติรายการ ---
async function fetchHistoryFromFirebase(phone) {
    const container = document.getElementById('historyBox');
    if (!container) return;

    try {
        const snapshot = await db.collection("transactions")
            .where("userPhone", "==", phone)
            .get();

        let html = "";
        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; padding:20px; color:#888;'>ไม่พบข้อมูลประวัติ</p>";
            return;
        }

        const docs = [];
        snapshot.forEach(doc => docs.push({
                                    id: doc.id,
                                    ...doc.data()
                                    }));
        // เรียงลำดับจากใหม่ไปเก่า
        docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        docs.forEach(item => {
            const isBorrow = item.type === 'borrow';
            const color = isBorrow ? '#4CAF50' : '#FF9800';
            const location = item.shopName || "ไม่ระบุสถานที่";

            html += `
                <div class="history-item" style="border-left: 5px solid ${color}; background:#fff; padding:15px; margin:10px; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="color:${color};">${isBorrow ? '📥 ยืมกล่อง' : '📤 คืนกล่อง'}</strong>
                        <small style="color:#888;">${item.date || ''}</small>
                    </div>
                    <div style="margin-top:8px; font-size:14px;">
                        เลขกล่อง: <b>${item.boxId || '-'}</b><br>
                        สถานที่: ${location}
                    </div>
                </div>`;
        });
        container.innerHTML = html;
    } catch (e) { console.error("Error:", e); }
}

// --- โหลดข้อมูลผู้ใช้ ---
async function loadUserData() {
    const userPhone = localStorage.getItem('userPhone');
    if(!userPhone) return;

    try {
        const userDoc = await db.collection("users").doc(userPhone).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            const setUI = (id, val) => { 
                const el = document.getElementById(id);
                if(el) el.innerText = val || "-"; 
            };
            setUI('username', data.name);
            setUI('userphone', data.phone);
            setUI('userid', data.studentId);
            setUI('userfaculty', data.faculty);
            setUI('useryear', data.year);
            setUI('points', data.points || 0);
            setUI('returnCountDisplay', data.returnCount || 0);
        }
    } catch (e) { console.error(e); }
}

// --- ออกจากระบบ ---
function logout() { 
    localStorage.clear(); 
    window.location.replace('login.html'); 
}

async function loadLeaderboard() {
    const tableBody = document.getElementById('leaderboardBody');
    if (!tableBody) return;

    // แสดงสถานะโหลด
    tableBody.innerHTML = `
        <tr>
            <td colspan="3" style="text-align:center; padding:20px;">
                ⏳ กำลังโหลดข้อมูล...
            </td>
        </tr>
    `;

    try {
        let snapshot;

        // ลอง orderBy ก่อน
        try {
            snapshot = await db.collection("users")
                .orderBy("points", "desc")
                .get();
        } catch (err) {
            console.warn("OrderBy ใช้ไม่ได้ ใช้วิธีปกติแทน:", err);
            snapshot = await db.collection("users").get();
        }

        if (snapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align:center; padding:20px; color:#888;">
                        ไม่พบรายชื่อสมาชิก
                    </td>
                </tr>
            `;
            return;
        }

        const users = [];

        snapshot.forEach(doc => {
            const data = doc.data() || {};
            users.push({
                id: doc.id,
                name: data.name || "ไม่ระบุชื่อ",
                phone: data.phone || "-",
                faculty: data.faculty || "",
                year: data.year || "",
                points: Number(data.points) || 0
            });
        });

        // เรียงซ้ำด้วย JS เพื่อความชัวร์
        users.sort((a, b) => b.points - a.points);

        let html = "";

        users.forEach((user, index) => {
            const rank = index + 1;
            const rowClass = rank === 1 ? "rank-1" : "";

            html += `
                <tr class="${rowClass}">
                    <td style="text-align:center;">${rank === 1 ? "🥇" : rank}</td>
                    <td>
                        <div style="font-weight:bold; color:#333;">${user.name}</div>
                        <div style="font-size:12px; color:#666;">📞 ${user.phone}</div>
                        <div style="font-size:11px; color:#888;">${user.faculty} ${user.year}</div>
                    </td>
                    <td style="text-align:right;">
                        <span class="points-badge">${user.points} แต้ม</span>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("โหลด leaderboard ล้มเหลว:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:center; color:red; padding:20px;">
                    ❌ เกิดข้อผิดพลาด: ${error.message}
                </td>
            </tr>
        `;
    }
}


async function deleteHistory(docId) {
    if (!confirm("ยืนยันการลบรายการนี้?\nคะแนนจะถูกปรับอัตโนมัติ")) return;

    try {
        const docRef = db.collection("transactions").doc(docId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            alert("ไม่พบข้อมูลรายการนี้");
            return;
        }

        const data = docSnap.data();
        const userPhone = data.userPhone;
        const type = data.type;

        const pointReduce = 1;
        const returnReduce = type === "return" ? 1 : 0;

        // 🔎 หา user ด้วย field phone
        const userQuery = await db.collection("users")
            .where("phone", "==", userPhone)
            .limit(1)
            .get();

        if (userQuery.empty) {
            alert("ไม่พบผู้ใช้ในระบบ");
            return;
        }

        const userRef = userQuery.docs[0].ref;
        const userData = userQuery.docs[0].data();

        const newPoints = Math.max((userData.points || 0) - pointReduce, 0);

        await userRef.update({
            points: newPoints,
            returnCount: firebase.firestore.FieldValue.increment(-returnReduce)
        });

        await docRef.delete();

        alert("ลบรายการและปรับคะแนนเรียบร้อยแล้ว");

        if (typeof fetchAllHistory === 'function') fetchAllHistory();
        if (typeof loadLeaderboard === 'function') loadLeaderboard();

    } catch (e) {
        console.error("Delete Error:", e);
        alert("เกิดข้อผิดพลาด: " + e.message);
    }
}


function handleRegTypeChange() {
    const type = document.getElementById("regType").value;
    const studentFields = document.getElementById("studentFields");

    if (type === "student") {
        studentFields.style.display = "block";
    } else if (type === "staff" || type === "guest") {
        studentFields.style.display = "none";
    } else {
        studentFields.style.display = "none";
    }
}
