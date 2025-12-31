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
    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.includes('login.html');
    const isRegisterPage = path.includes('register.html');
    const isAdminPage = path.includes('admin');

    // รอให้ LINE และ Firebase ตรวจสอบสถานะให้เสร็จก่อน
    await initLIFF();

    const userPhone = localStorage.getItem('userPhone'); // จะมีค่าถ้ามี user ใน Firebase เท่านั้น

    // จัดการเรื่องการดึงชื่อจาก LINE มาใส่ในหน้าสมัคร
    const tempName = localStorage.getItem('tempLineName');
    if (tempName && document.getElementById('regName')) {
        document.getElementById('regName').value = tempName;
    }

    // --- ระบบควบคุมเส้นทาง (Routing) ---
    if (!userPhone) {
        // กรณีไม่มีข้อมูลในระบบ และไม่ได้อยู่หน้าสมัครหรือแอดมิน -> บังคับไปหน้า Register
        if (!isRegisterPage && !isAdminPage) {
            window.location.replace('register.html');
            return;
        }
    } else {
        // กรณีมีข้อมูลในระบบแล้ว แต่ดันหลงไปหน้า Register หรือ Login -> ส่งไปหน้าหลัก
        if (isRegisterPage || isLoginPage) {
            window.location.replace('index.html');
            return;
        }
    }

    loadUserData();
};

// 3. ฟังก์ชันเชื่อมต่อ LINE และเช็คฐานข้อมูล
async function initLIFF() {
    try {
        await liff.init({ liffId: "2008458855-wE0xODVx" });
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            const lineUserId = profile.userId;

            // ตรวจสอบใน Firebase ทันที
            const userDoc = await db.collection("users").doc(lineUserId).get();
            
            // ในส่วนของ initLIFF ตรงที่เช็ค userDoc.exists
            if (userDoc.exists) {
              const userData = userDoc.data();
              localStorage.setItem('userPhone', lineUserId);
              localStorage.setItem('userName', userData.name);
              localStorage.setItem('userPoints', userData.points || 0);
              // ✅ บรรทัดนี้สำคัญมาก ต้องดึงค่า phone จาก Firebase มาเก็บไว้โชว์
              localStorage.setItem('realPhone', userData.phone || 'ไม่มีเบอร์'); 
} else {
                // ❌ ไม่พบในฐานข้อมูล: ล้างค่าเก่า และเตรียมข้อมูลไปหน้าสมัคร
                localStorage.removeItem('userPhone');
                localStorage.setItem('tempLineName', profile.displayName);
                localStorage.setItem('tempLineUserId', lineUserId);
            }
        } else {
            // ถ้ายังไม่ Login LINE ให้สั่ง Login อัตโนมัติ
            liff.login();
        }
    } catch (error) {
        console.error("LIFF Error:", error);
    }
}

async function performRegister() {
    // 1. ดึงค่าจากหน้าจอ
    const name = document.getElementById('regName').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;
    const lineUserId = localStorage.getItem('tempLineUserId'); 

    // 2. ตรวจสอบความถูกต้องก่อนส่งข้อมูล
    if (!lineUserId) { alert("กรุณาเปิดผ่าน LINE"); return; }
    if (!name || !phone || !pass) { alert("กรุณากรอกข้อมูลให้ครบถ้วน"); return; }
    if (pass !== confirmPass) { alert("รหัสผ่านไม่ตรงกัน"); return; }

    try {
        // 3. บันทึกลง Firebase
        await db.collection("users").doc(lineUserId).set({
            name: name,
            phone: phone,
            password: pass,
            lineId: lineUserId,
            points: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 4. เซ็ตค่าลงเครื่อง (หลังจากบันทึกสำเร็จเท่านั้น)
        localStorage.setItem('userPhone', lineUserId); 
        localStorage.setItem('realPhone', phone);
        localStorage.setItem('userName', name);
        localStorage.setItem('userPoints', 0);

        // 5. แจ้งเตือนแค่ครั้งเดียวและย้ายหน้าทันที
        alert("ลงทะเบียนสมาชิกใหม่สำเร็จ!");
        window.location.replace('index.html'); // ใช้ replace เพื่อตัดวงจรการเด้งกลับ

    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    }
}

function loadUserData() {
    const name = localStorage.getItem('userName') || 'ผู้ใช้งาน';
    // ✅ ดึงค่า realPhone มาแสดง (ถ้าไม่มีให้โชว์ขีดกลาง)
    const displayPhone = localStorage.getItem('realPhone') || '-'; 
    const points = localStorage.getItem('userPoints') || '0';

    if (document.getElementById('username')) document.getElementById('username').innerText = name;
    
    // ✅ เช็คว่า ID ใน HTML ของคุณชื่อ 'userphone' หรือเปล่า (ตัวเล็กทั้งหมด)
    if (document.getElementById('userphone')) {
        document.getElementById('userphone').innerText = displayPhone;
    }
    
    if (document.getElementById('points')) document.getElementById('points').innerText = points;
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

// 7. ออกจากระบบ
function logout() {
    localStorage.clear();
    window.location.replace('register.html');
}











