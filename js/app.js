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
const storage = firebase.storage();

// 2. ฟังก์ชันเริ่มงานเมื่อโหลดหน้าจอ
window.onload = async function() {
    await initLIFF(); 

    const userPhone = localStorage.getItem('userPhone');
    const path = window.location.pathname.toLowerCase();

    const isLoginPage = path.includes('login.html');
    const isRegisterPage = path.includes('register.html');
    const isAdminPage = path.includes('admin');

    // เติมชื่อจาก LINE ลงช่องสมัครอัตโนมัติ (ถ้ามี)
    const tempName = localStorage.getItem('tempLineName');
    if (tempName && document.getElementById('regName')) {
        document.getElementById('regName').value = tempName;
    }

    // เช็คสิทธิ์การเข้าถึง
    if (!userPhone && !isLoginPage && !isRegisterPage && !isAdminPage) {
        window.location.href = 'login.html';
        return;
    }
    
    if (userPhone && (isLoginPage || isRegisterPage)) {
        window.location.href = 'index.html';
        return;
    }

    loadUserData();
    if (document.getElementById('pointsDisplay')) renderPoints();
};

// 3. ฟังก์ชันเชื่อมต่อ LINE
async function initLIFF() {
    try {
        await liff.init({ liffId: "2008458855-wE0xODVx" });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            const lineUserId = profile.userId;

            const userDoc = await db.collection("users").doc(lineUserId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                localStorage.setItem('userPhone', lineUserId);
                localStorage.setItem('userName', userData.name);
                localStorage.setItem('userPoints', userData.points || 0);
            } else {
                localStorage.setItem('tempLineName', profile.displayName);
                localStorage.setItem('tempLineUserId', lineUserId);
                if (!window.location.pathname.includes('register.html')) {
                    window.location.href = 'register.html';
                }
            }
        }
    } catch (error) {
        console.error("LIFF Error:", error);
    }
}

// 4. ฟังก์ชันลงทะเบียน (ใช้เวอร์ชันที่รองรับ LINE)
async function performRegister() {
    const name = document.getElementById('regName').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;
    
    const lineUserId = localStorage.getItem('tempLineUserId') || phone;

    if (!name || !phone || !pass) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }
    if (pass !== confirmPass) {
        alert("รหัสผ่านไม่ตรงกัน");
        return;
    }

    try {
        await db.collection("users").doc(lineUserId).set({
            name: name,
            phone: phone,
            password: pass,
            lineId: lineUserId,
            points: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        localStorage.setItem('userPhone', lineUserId);
        localStorage.setItem('userName', name);
        localStorage.setItem('userPoints', 0);

        alert("ลงทะเบียนสำเร็จ!");
        window.location.href = 'index.html';
    } catch (error) {
        alert("สมัครไม่สำเร็จ: " + error.message);
    }
}

// 5. ฟังก์ชันเข้าสู่ระบบ (สำหรับคนไม่ได้ใช้ LINE)
async function performLogin() {
    const phone = document.getElementById('loginPhone').value;
    const pass = document.getElementById('loginPassword').value;

    if (!phone || !pass) { alert("กรุณากรอกข้อมูล"); return; }

    try {
        // ค้นหาทั้งในชื่อ ID (เบอร์โทร)
        const userDoc = await db.collection("users").doc(phone).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.password === pass) {
                localStorage.setItem('userPhone', phone);
                localStorage.setItem('userName', userData.name);
                localStorage.setItem('userPoints', userData.points || 0);
                alert("เข้าสู่ระบบสำเร็จ");
                window.location.href = 'index.html';
            } else { alert("รหัสผ่านผิด"); }
        } else { alert("ไม่พบข้อมูลผู้ใช้"); }
    } catch (error) { alert("Error: " + error.message); }
}

function loadUserData() {
    const name = localStorage.getItem('userName') || 'ผู้ใช้งาน';
    const phone = localStorage.getItem('userPhone') || '...';
    const points = localStorage.getItem('userPoints') || '0';

    if (document.getElementById('username')) document.getElementById('username').innerText = name;
    if (document.getElementById('userphone')) document.getElementById('userphone').innerText = phone;
    if (document.getElementById('points')) document.getElementById('points').innerText = points;
    if (document.getElementById('pointsDisplay')) document.getElementById('pointsDisplay').innerText = points;
}

async function returnBoxWithImage() {
    const boxId = document.getElementById('boxInputReturn').value;
    const imageFile = document.getElementById('imageInputReturn').files[0];
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !imageFile) { alert("กรุณาระบุหมายเลขกล่องและถ่ายรูป"); return; }

    try {
        const storageRef = storage.ref(`returns/${Date.now()}_${boxId}.jpg`);
        await storageRef.put(imageFile);
        const imageUrl = await storageRef.getDownloadURL();

        await db.collection("transactions").add({
            boxId: boxId,
            userPhone: userPhone,
            type: 'return',
            imageUrl: imageUrl,
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        const userRef = db.collection("users").doc(userPhone);
        await userRef.update({ points: firebase.firestore.FieldValue.increment(10) });

        let currentPoints = parseInt(localStorage.getItem('userPoints') || 0);
        currentPoints += 10;
        localStorage.setItem('userPoints', currentPoints);

        alert("คืนกล่องสำเร็จ! ได้รับ 10 คะแนน");
        location.href = 'index.html';
    } catch (error) { alert("เกิดข้อผิดพลาดในการบันทึก"); }
}

function logout() {
    localStorage.clear();
    location.href = 'login.html';
}





