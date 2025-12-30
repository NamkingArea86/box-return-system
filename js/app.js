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

// 2. ฟังก์ชันเริ่มต้นทำงานเมื่อโหลดหน้าจอ
window.onload = async function() {
    // --- ส่วนของ LIFF ---
    await initLIFF();

    // --- ส่วนดึงชื่อจาก LINE มาใส่ช่อง Register ---
    const tempName = localStorage.getItem('tempLineName');
    if (tempName && document.getElementById('regName')) {
        document.getElementById('regName').value = tempName;
        // หลังจากใช้เสร็จอาจจะลบออกเพื่อไม่ให้ค้าง
        // localStorage.removeItem('tempLineName'); 
    }

    // --- ตรวจสอบสิทธิ์การเข้าถึงหน้าปกติ ---
    const userPhone = localStorage.getItem('userPhone');
    const path = window.location.pathname;
    const isPublicPage = path.includes('login.html') || path.includes('register.html') || path.includes('admin');

    if (!userPhone && !isPublicPage) {
        window.location.href = 'login.html';
        return;
    }

    // โหลดข้อมูลผู้ใช้ปกติ
    loadUserData();
};

// 3. ฟังก์ชันเชื่อมต่อ LINE
async function initLIFF() {
    try {
        await liff.init({ liffId: "2008458855-wE0xODVx" });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            const lineUserId = profile.userId;

            // ตรวจสอบว่าเคยสมัครสมาชิกหรือยัง
            const userDoc = await db.collection("users").doc(lineUserId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                localStorage.setItem('userPhone', lineUserId);
                localStorage.setItem('userName', userData.name);
                localStorage.setItem('userPoints', userData.points || 0);
            } else {
                // ถ้ายังไม่เคยสมัคร ให้เก็บชื่อไว้ไปใส่ในช่อง Register
                localStorage.setItem('tempLineName', profile.displayName);
                localStorage.setItem('tempLineUserId', lineUserId);
                
                // ถ้ายังไม่ได้อยู่ที่หน้าสมัคร ให้ดีดไปหน้าสมัคร
                if (!window.location.pathname.includes('register.html')) {
                    window.location.href = 'register.html';
                }
            }
        } else {
            // กรณีเปิดผ่านเบราว์เซอร์ปกติที่ไม่ได้ล็อกอิน LINE
            // คุณอาจจะให้เขาใช้ระบบ Login แบบเบอร์โทรปกติ
        }
    } catch (error) {
        console.error("LIFF Error:", error);
    }
}

async function performRegister() {
    console.log("เริ่มฟังก์ชันลงทะเบียน..."); // ไว้เช็คใน Console ว่าฟังก์ชันทำงานไหม
    
    const name = document.getElementById('regName').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;
    
    // ดึง Line ID มาจาก LocalStorage (ที่ได้จาก initLIFF)
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
        console.log("กำลังบันทึกลง Firebase...");
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
        console.error("Firebase Error:", error);
        alert("สมัครไม่สำเร็จ: " + error.message);
    }
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

// --- ส่วนที่เพิ่มใหม่: ฟังก์ชันสำหรับหน้า Login และ Register ---

// ฟังก์ชันเข้าสู่ระบบ (เรียกใช้จาก login.html)
async function performLogin() {
    const phone = document.getElementById('loginPhone').value;
    const pass = document.getElementById('loginPassword').value;

    if (!phone || !pass) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    try {
        // ค้นหาผู้ใช้จากเบอร์โทรใน Firestore
        const userDoc = await db.collection("users").doc(phone).get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.password === pass) {
                // เก็บข้อมูลลงเครื่อง
                localStorage.setItem('userPhone', phone);
                localStorage.setItem('userName', userData.name);
                localStorage.setItem('userPoints', userData.points || 0);
                
                alert("เข้าสู่ระบบสำเร็จ");
                window.location.href = 'index.html';
            } else {
                alert("รหัสผ่านไม่ถูกต้อง");
            }
        } else {
            alert("ไม่พบเบอร์โทรศัพท์นี้ในระบบ");
        }
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    }
}

// ฟังก์ชันลงทะเบียน (เรียกใช้จาก register.html)
async function performRegister() {
    const name = document.getElementById('regName').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;

    if (!name || !phone || !pass) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }
    if (pass !== confirmPass) {
        alert("รหัสผ่านไม่ตรงกัน");
        return;
    }

    try {
        // บันทึกลง Firestore โดยใช้เบอร์โทรเป็น ID ของ Document
        await db.collection("users").doc(phone).set({
            name: name,
            phone: phone,
            password: pass,
            points: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("ลงทะเบียนสำเร็จ! กรุณาเข้าสู่ระบบ");
        window.location.href = 'login.html';
    } catch (error) {
        alert("ไม่สามารถลงทะเบียนได้: " + error.message);
    }
}


async function returnBoxWithImage() {
    // ... โค้ดเดิมของคุณ (แต่เพิ่มการอัปเดตแต้มใน Firestore ด้วย) ...
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

        // อัปเดตคะแนนใน Firestore
        const userRef = db.collection("users").doc(userPhone);
        await userRef.update({
            points: firebase.firestore.FieldValue.increment(10)
        });

        // อัปเดตคะแนนในเครื่อง (LocalStorage)
        let currentPoints = parseInt(localStorage.getItem('userPoints') || 0);
        currentPoints += 10;
        localStorage.setItem('userPoints', currentPoints);

        alert("คืนกล่องสำเร็จ! คุณได้รับ 10 คะแนน");
        location.href = 'index.html';
    } catch (error) { alert("เกิดข้อผิดพลาด"); }
}

function logout() {
    localStorage.clear();
    location.href = 'login.html';
}





