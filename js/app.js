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

// 2. ฟังก์ชันตรวจสอบสิทธิ์เมื่อโหลดหน้าจอ
window.onload = function() {
    const userPhone = localStorage.getItem('userPhone');
    const path = window.location.pathname.toLowerCase();

    const isLoginPage = path.includes('login.html');
    const isRegisterPage = path.includes('register.html');
    const isAdminPage = path.includes('admin');

    // ถ้าไม่ได้ล็อกอิน และไม่ใช่หน้าสาธารณะ -> ไปหน้า Login
    if (!userPhone && !isLoginPage && !isRegisterPage && !isAdminPage) {
        window.location.replace('login.html');
        return;
    }
    
    // ถ้าล็อกอินแล้ว ห้ามเข้าหน้า Login/Register
    if (userPhone && (isLoginPage || isRegisterPage)) {
        window.location.replace('index.html');
        return;
    }

    if (userPhone) loadUserData();
};

// 3. ฟังก์ชันลงทะเบียน (ใช้เบอร์โทรเป็น ID)
async function performRegister() {
    const name = document.getElementById('regName').value;
    const faculty = document.getElementById('regFaculty').value; // ดึงคณะ
    const year = document.getElementById('regYear').value;       // ดึงชั้นปี
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;

    // ตรวจสอบข้อมูลให้ครบ
    if (!name || !faculty || !year || !phone || !pass) { 
        alert("กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง"); 
        return; 
    }
    if (pass !== confirmPass) { alert("รหัสผ่านไม่ตรงกัน"); return; }

    try {
        await db.collection("users").doc(phone).set({
            name: name,
            faculty: faculty, // บันทึกคณะ
            year: year,       // บันทึกชั้นปี
            phone: phone,
            password: pass,
            points: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // เก็บข้อมูลลงเครื่อง
        localStorage.setItem('userPhone', phone);
        localStorage.setItem('userName', name);
        localStorage.setItem('userFaculty', faculty);
        localStorage.setItem('userYear', year);
        localStorage.setItem('userPoints', 0);

        alert("ลงทะเบียนสำเร็จ!");
        window.location.replace('index.html');
    } catch (error) {
        alert("สมัครไม่สำเร็จ: " + error.message);
    }
}

// 4. ฟังก์ชันเข้าสู่ระบบ
async function performLogin() {
    const phone = document.getElementById('loginPhone').value;
    const pass = document.getElementById('loginPassword').value;

    if (!phone || !pass) { alert("กรุณากรอกข้อมูลให้ครบ"); return; }

    try {
        const userDoc = await db.collection("users").doc(phone).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.password === pass) {
                localStorage.setItem('userPhone', phone);
                localStorage.setItem('userName', userData.name);
                localStorage.setItem('userPoints', userData.points || 0);
                window.location.replace('index.html');
            } else { alert("รหัสผ่านไม่ถูกต้อง"); }
        } else { alert("ไม่พบเบอร์โทรศัพท์นี้ในระบบ"); }
    } catch (error) { alert("เกิดข้อผิดพลาด: " + error.message); }
}

// 5. แสดงผลข้อมูล
function loadUserData() {
    const name = localStorage.getItem('userName') || 'ผู้ใช้งาน';
    const phone = localStorage.getItem('userPhone') || '...';
    const faculty = localStorage.getItem('userFaculty') || '-';
    const year = localStorage.getItem('userYear') || '-';
    const points = localStorage.getItem('userPoints') || '0';

    if (document.getElementById('username')) document.getElementById('username').innerText = name;
    if (document.getElementById('userphone')) document.getElementById('userphone').innerText = phone;
    if (document.getElementById('userfaculty')) document.getElementById('userfaculty').innerText = faculty;
    if (document.getElementById('useryear')) document.getElementById('useryear').innerText = year;
    if (document.getElementById('points')) document.getElementById('points').innerText = points;
    if (document.getElementById('pointsDisplay')) document.getElementById('pointsDisplay').innerText = points;
}

// 6. ฟังก์ชันคืนกล่อง
async function returnBoxWithImage() {
    const boxId = document.getElementById('boxInputReturn').value;
    const imageFile = document.getElementById('imageInputReturn').files[0];
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !imageFile) { alert("กรุณาระบุข้อมูลให้ครบ"); return; }

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

        alert("คืนกล่องสำเร็จ!");
        window.location.replace('index.html');
    } catch (error) { alert("เกิดข้อผิดพลาด"); }
}

function logout() {
    localStorage.clear();
    window.location.replace('login.html');
}










