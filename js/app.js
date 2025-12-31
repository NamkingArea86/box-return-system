// 1. ตั้งค่า Firebase
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
    const isLoginPage = path.includes('login.html');
    const isRegisterPage = path.includes('register.html');

    if (!userPhone && !isLoginPage && !isRegisterPage) {
        window.location.replace('login.html');
        return;
    }
    
    if (userPhone) {
        await loadUserData(); 
        if (path.includes('history.html')) fetchHistoryFromFirebase(userPhone); 
        if (path.includes('rewards.html')) loadLeaderboard();
    }
};

// 3. ฟังก์ชันยืมกล่อง (ใส่แค่เลขกล่อง + ชื่อร้าน) - เร็วมากเพราะไม่มีรูป
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
        window.location.replace('index.html');
    } catch (e) {
        alert("เกิดข้อผิดพลาด: " + e.message);
    }
}

// 4. ฟังก์ชันคืนกล่อง (สแกน QR + เลขกล่อง)
async function returnBoxWithQR(scannedShopId) {
    const boxId = document.getElementById('boxInputReturn').value;
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId) { 
        alert("กรุณาระบุหมายเลขกล่องก่อนสแกน"); 
        return; 
    }

    try {
        await db.collection("transactions").add({
            boxId: boxId,
            shopName: scannedShopId, // ชื่อร้านจาก QR
            userPhone: userPhone,
            type: 'return',
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // อัปเดตคะแนน +5
        await db.collection("users").doc(userPhone).update({ 
            points: firebase.firestore.FieldValue.increment(5),
            returnCount: firebase.firestore.FieldValue.increment(1)
        });

        alert("คืนกล่องสำเร็จ! ได้รับ 5 แต้ม");
        window.location.replace('index.html');
    } catch (e) {
        alert("เกิดข้อผิดพลาด: " + e.message);
    }
}

// --- ฟังก์ชันอื่นๆ (ลงทะเบียน, ล็อกอิน, โหลดข้อมูล) ---
async function performRegister() {
    const name = document.getElementById('regName').value;
    const studentId = document.getElementById('regStudentId').value;
    const faculty = document.getElementById('regFaculty').value;
    const year = document.getElementById('regYear').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;

    if (studentId.length !== 10) { alert("รหัสนักศึกษาต้องมี 10 หลัก"); return; }
    if (pass !== confirmPass) { alert("รหัสผ่านไม่ตรงกัน"); return; }

    try {
        await db.collection("users").doc(phone).set({
            name, studentId, faculty, year, phone, password: pass, points: 0, returnCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        localStorage.setItem('userPhone', phone);
        window.location.replace('index.html');
    } catch (e) { alert(e.message); }
}

async function performLogin() {
    const phone = document.getElementById('loginPhone').value;
    const pass = document.getElementById('loginPassword').value;
    try {
        const userDoc = await db.collection("users").doc(phone).get();
        if (userDoc.exists && userDoc.data().password === pass) {
            localStorage.setItem('userPhone', phone);
            window.location.replace('index.html');
        } else { alert("ข้อมูลไม่ถูกต้อง"); }
    } catch (e) { alert(e.message); }
}

async function loadUserData() {
    const userPhone = localStorage.getItem('userPhone');
    if(!userPhone) return;
    const userDoc = await db.collection("users").doc(userPhone).get();
    if (userDoc.exists) {
        const data = userDoc.data();
        const setUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
        setUI('username', data.name);
        setUI('userphone', data.phone);
        setUI('userid', data.studentId);
        setUI('userfaculty', data.faculty);
        setUI('useryear', data.year);
        setUI('points', data.points);
        setUI('returnCountDisplay', data.returnCount);
    }
}

function logout() { localStorage.clear(); window.location.replace('login.html'); }
