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

        alert(
            "✅ ยืมกล่องสำเร็จ\n\n" +
            "📦 เลขกล่อง: " + boxId + "\n" +
            "🏪 สถานที่ยืม: " + shopName + "\n" +
            "⭐ ได้รับ 1 แต้ม"
        );

        window.location.replace('history.html');
    } catch (e) { alert("เกิดข้อผิดพลาด: " + e.message); }
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

        alert(
            "✅ คืนกล่องสำเร็จ\n\n" +
            "📦 เลขกล่อง: " + boxId + "\n" +
            "📍 จุดคืน: " + cleanLocation + "\n" +
            "⭐ ได้รับ 1 แต้ม"
        );

        window.location.replace('history.html');
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
        snapshot.forEach(doc => docs.push(doc.data()));
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

// ฟังก์ชันดึงอันดับคะแนนผู้ใช้ทุกคน (Leaderboard All Users)
async function loadLeaderboard() {
    const tableBody = document.getElementById('leaderboardBody');
    if (!tableBody) return;

    try {
        // 1. ลองดึงข้อมูลแบบเรียงลำดับ (วิธีนี้ต้องการ Index ใน Firebase)
        let snapshot;
        try {
            snapshot = await db.collection("users")
                .orderBy("points", "desc")
                .get();
        } catch (orderByError) {
            console.warn("OrderBy Error (อาจจะลืมทำ Index):", orderByError);
            // 2. ถ้าดึงแบบเรียงลำดับไม่ได้ ให้ดึงแบบธรรมดามาโชว์ก่อน (กันหน้าจอขาว)
            snapshot = await db.collection("users").get();
        }

        if (snapshot.empty) {
            tableBody.innerHTML = "<tr><td colspan='3' style='text-align:center; padding:20px;'>ไม่พบรายชื่อสมาชิกในระบบ</td></tr>";
            return;
        }

        let users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });

        // ถ้าต้องดึงแบบธรรมดามา ให้เรียงลำดับด้วย JavaScript แทนเพื่อแก้ปัญหา Index
        users.sort((a, b) => (b.points || 0) - (a.points || 0));

        let html = "";
        users.forEach((data, index) => {
            const rank = index + 1;
            const rowClass = rank === 1 ? 'rank-1' : '';
            
            html += `
                <tr class="${rowClass}">
                    <td style="text-align:center;">${rank === 1 ? '🥇' : rank}</td>
                    <td>
                        <div style="font-weight:bold; color:#333;">${data.name || "ไม่ระบุชื่อ"}</div>
                        <div style="font-size:12px; color:#666;">📞 ${data.phone || "-"}</div>
                        <div style="font-size:11px; color:#888;">${data.faculty || ""} ${data.year || ""}</div>
                    </td>
                    <td style="text-align:right;">
                        <span class="points-badge">${data.points || 0} แต้ม</span>
                    </td>
                </tr>`;
        });

        tableBody.innerHTML = html;

    } catch (e) {
        console.error("Main Leaderboard Error:", e);
        tableBody.innerHTML = "<tr><td colspan='3' style='text-align:center; color:red; padding:20px;'>เกิดข้อผิดพลาด: " + e.message + "</td></tr>";
    }
}

// ฟังก์ชันลบประวัติ (Admin Only) และหักแต้มคืนหากเป็นการคืนกล่อง
async function deleteHistory(docId) {
    if (!confirm("ยืนยันการลบรายการนี้?\n- หากเป็น 'คืนกล่อง': แต้มจะลด 5 แต้ม และสถิติคืนจะลดลง 1")) {
        return;
    }

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

        // --- ส่วนที่ปรับปรุง: เช็คตัวตนผู้ใช้ก่อนหักแต้ม ---
        if (type === 'return') {
            const userRef = db.collection("users").doc(userPhone);
            const userSnap = await userRef.get();

            if (userSnap.exists) {
                await userRef.update({
                    points: firebase.firestore.FieldValue.increment(-1),
                    returnCount: firebase.firestore.FieldValue.increment(-1)
                });
                console.log("หักแต้มและลดจำนวนครั้งสำเร็จสำหรับ:", userPhone);
            } else {
                console.warn("ไม่พบข้อมูลผู้ใช้รายนี้ในระบบ แต้มจึงไม่ถูกหัก");
            }
        }

        // ลบรายการออกจากประวัติ
        await docRef.delete();

        alert("ลบรายการเรียบร้อยแล้ว");
        
        // ตรวจสอบว่ามีฟังก์ชันโหลดข้อมูลใหม่หรือไม่ก่อนเรียกใช้
        if (typeof fetchAllHistory === 'function') {
            fetchAllHistory();
        } else {
            location.reload(); // ถ้าไม่มีฟังก์ชันให้ Refresh หน้าแทน
        }

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
