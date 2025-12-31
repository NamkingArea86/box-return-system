// 1. ตั้งค่า Firebase (คงเดิม)
const firebaseConfig = {
    apiKey: "AIzaSyDRYTht-6h5QDqFTGO6sr44TfuvDfApAPc",
    authDomain: "box-return-system.firebaseapp.com",
    projectId: "box-return-system",
    storageBucket: "box-return-system.firebasestorage.app",
    messagingSenderId: "272291754420",
    appId: "1:272291754420:web:9ee1c794acbe190309c2e1",
    measurementId: "G-8PX3LBXM3L"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// 2. จัดการเมื่อโหลดหน้าจอ
window.onload = async function() {
    const userPhone = localStorage.getItem('userPhone');
    const path = window.location.pathname.toLowerCase();
    
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

// 3. ฟังก์ชันลงทะเบียน (แก้ไขจุดที่ทำให้กดไม่ได้)
async function performRegister() {
    try {
        // ดักจับ Element ให้ชัวร์ก่อนดึงค่า .value
        const getVal = (id) => {
            const el = document.getElementById(id);
            if (!el) console.error("ไม่พบ Element ID:", id);
            return el ? el.value.trim() : "";
        };

        const name = getVal('regName');
        const studentId = getVal('regStudentId');
        const faculty = getVal('regFaculty');
        const year = getVal('regYear');
        const phone = getVal('regPhone');
        const pass = document.getElementById('regPassword').value; // ไม่ trim รหัสผ่าน
        const confirmPass = document.getElementById('regConfirmPassword').value;

        // 1. ตรวจสอบว่ากรอกครบไหม
        if (!name || !studentId || !faculty || !year || !phone || !pass || !confirmPass) {
            alert("กรุณากรอกข้อมูลให้ครบทุกช่อง");
            return;
        }

        // 2. ตรวจสอบรหัสนักศึกษา (10 หลัก)
        if (studentId.length !== 10) {
            alert("รหัสนักศึกษาต้องมี 10 หลักเท่านั้น");
            return;
        }

        // 3. ตรวจสอบรหัสผ่าน (REGEX)
        const passRegex = /^(?=.*[a-zA-Z])(?=.*[0-9]).{1,10}$/;
        if (!passRegex.test(pass)) {
            alert("รหัสผ่านต้องมีทั้งภาษาอังกฤษและตัวเลข (ไม่เกิน 10 หลัก)");
            return;
        }

        // 4. ตรวจสอบว่ารหัสผ่านตรงกันไหม
        if (pass !== confirmPass) {
            alert("รหัสผ่านไม่ตรงกัน");
            return;
        }

        // 5. บันทึกลง Firebase
        await db.collection("users").doc(phone).set({
            name: name,
            studentId: studentId,
            faculty: faculty,
            year: year,
            phone: phone,
            password: pass,
            points: 0,
            returnCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        localStorage.setItem('userPhone', phone);
        alert("ลงทะเบียนสำเร็จ!");
        window.location.replace('index.html');

    } catch (error) {
        console.error("Register Error:", error);
        alert("เกิดข้อผิดพลาด: " + error.message);
    }
}

// 4. ฟังก์ชันยืมกล่อง (คงเดิม)
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
        alert("ยืมกล่องสำเร็จ!");
        window.location.replace('history.html');
    } catch (e) { alert("เกิดข้อผิดพลาด: " + e.message); }
}

// 5. ฟังก์ชันคืนกล่อง (คงเดิม)
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
            points: firebase.firestore.FieldValue.increment(5),
            returnCount: firebase.firestore.FieldValue.increment(1)
        });

        alert("คืนสำเร็จที่: " + cleanLocation + "\nได้รับ 5 แต้ม!");
        window.location.replace('history.html');

    } catch (e) { alert("เกิดข้อผิดพลาด: " + e.message); }
}

// 6. ฟังก์ชันดึงประวัติ (คงเดิม)
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

// 7. โหลดข้อมูลผู้ใช้ (คงเดิม)
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

function logout() { localStorage.clear(); window.location.replace('login.html'); }




