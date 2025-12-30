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

window.onload = async function() {
    // 1. ตรวจสอบก่อนว่าในเครื่องมีข้อมูลอยู่แล้วไหม
    let userPhone = localStorage.getItem('userPhone');
    const path = window.location.pathname.toLowerCase();
    
    const isLoginPage = path.includes('login.html');
    const isRegisterPage = path.includes('register.html');
    const isAdminPage = path.includes('admin');

    // 2. ถ้ายังไม่มีข้อมูลในเครื่อง ให้รอถาม LINE (initLIFF)
    if (!userPhone) {
        await initLIFF();
        userPhone = localStorage.getItem('userPhone'); // เช็คอีกรอบหลังจากรอ LINE
    }

    // 3. Logic การตัดสินใจย้ายหน้า (ย้ายครั้งเดียวจบ)
    if (!userPhone) {
        // ถ้าถาม LINE แล้วก็ยังไม่มีข้อมูล (คนใหม่จริง ๆ)
        if (!isLoginPage && !isRegisterPage && !isAdminPage) {
            window.location.replace('login.html');
        }
    } else {
        // ถ้ามีข้อมูลแล้ว ห้ามอยู่หน้าสมัคร/ล็อกอิน
        if (isLoginPage || isRegisterPage) {
            window.location.replace('index.html');
        }
    }

    // 4. แสดงผลข้อมูล
    loadUserData();
};

async function initLIFF() {
    try {
        await liff.init({ liffId: "2008458855-wE0xODVx" });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            const lineUserId = profile.userId;

            // ตรวจสอบใน Firebase
            const userDoc = await db.collection("users").doc(lineUserId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                localStorage.setItem('userPhone', lineUserId);
                localStorage.setItem('realPhone', userData.phone);
                localStorage.setItem('userName', userData.name);
                localStorage.setItem('userPoints', userData.points || 0);
            } else {
                // ถ้าไม่เคยสมัคร ให้เตรียมชื่อไว้เฉยๆ แต่อย่าเพิ่งดีดหน้าในนี้ (ให้ onload จัดการ)
                localStorage.setItem('tempLineName', profile.displayName);
                localStorage.setItem('tempLineUserId', lineUserId);
            }
        }
    } catch (error) {
        console.error("LIFF Error:", error);
    }
}

// 4. ฟังก์ชันลงทะเบียน
async function performRegister() {
    const name = document.getElementById('regName').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;
    const lineUserId = localStorage.getItem('tempLineUserId'); 

    if (!lineUserId) { alert("กรุณาเปิดแอปผ่าน LINE"); return; }
    if (!name || !phone || !pass) { alert("กรุณากรอกข้อมูลให้ครบถ้วน"); return; }
    if (pass !== confirmPass) { alert("รหัสผ่านไม่ตรงกัน"); return; }

    try {
        await db.collection("users").doc(lineUserId).set({
            name: name,
            phone: phone, // เบอร์โทรที่กรอก
            password: pass,
            lineId: lineUserId,
            points: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        localStorage.setItem('userPhone', lineUserId); 
        localStorage.setItem('realPhone', phone); // ✅ เก็บเบอร์โทรจริง
        localStorage.setItem('userName', name);
        localStorage.setItem('userPoints', 0);

        alert("ลงทะเบียนสำเร็จ!");
        window.location.href = 'index.html';
    } catch (error) {
        alert("สมัครไม่สำเร็จ: " + error.message);
    }
}

// 5. แสดงผลข้อมูล
function loadUserData() {
    const name = localStorage.getItem('userName') || 'ผู้ใช้งาน';
    // ✅ ดึงเบอร์จริงมาโชว์ ถ้าไม่มีให้ใช้ตัวสำรอง
    const displayPhone = localStorage.getItem('realPhone') || localStorage.getItem('userPhone') || '...';
    const points = localStorage.getItem('userPoints') || '0';

    if (document.getElementById('username')) document.getElementById('username').innerText = name;
    if (document.getElementById('userphone')) document.getElementById('userphone').innerText = displayPhone;
    if (document.getElementById('points')) document.getElementById('points').innerText = points;
    if (document.getElementById('pointsDisplay')) document.getElementById('pointsDisplay').innerText = points;
}

// 6. ฟังก์ชันคืนกล่อง
async function returnBoxWithImage() {
    const boxId = document.getElementById('boxInputReturn').value;
    const imageFile = document.getElementById('imageInputReturn').files[0];
    const userPhone = localStorage.getItem('userPhone'); // ใช้ Line ID บันทึก

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
        window.location.href = 'index.html';
    } catch (error) { alert("เกิดข้อผิดพลาดในการบันทึก"); }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}








