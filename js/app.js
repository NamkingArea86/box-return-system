// 1. ตั้งค่า Firebase (นำมาจากหน้า Console ของคุณ)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// 2. ฟังก์ชันเริ่มงาน (เช็คสถานะการล็อกอิน และคะแนน)
window.onload = function() {
    loadUserData();
    if (document.getElementById('pointsDisplay')) renderPoints();
};

function loadUserData() {
    const name = localStorage.getItem('userName') || 'ผู้ใช้งาน';
    const phone = localStorage.getItem('userPhone') || '...';
    const points = localStorage.getItem('userPoints') || '0';

    if (document.getElementById('username')) document.getElementById('username').innerText = name;
    if (document.getElementById('userphone')) document.getElementById('userphone').innerText = phone;
    if (document.getElementById('points')) document.getElementById('points').innerText = points;
}

// 3. ฟังก์ชันยืมกล่อง (ส่งข้อมูล + อัปโหลดรูป)
async function borrowBoxWithImage() {
    const boxId = document.getElementById('boxInput').value;
    const imageFile = document.getElementById('imageInput').files[0];
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !imageFile) {
        alert("กรุณาระบุหมายเลขกล่องและถ่ายรูป");
        return;
    }

    try {
        // อัปโหลดรูปไปที่ Firebase Storage
        const storageRef = storage.ref(`borrows/${Date.now()}_${boxId}.jpg`);
        await storageRef.put(imageFile);
        const imageUrl = await storageRef.getDownloadURL();

        // บันทึกข้อมูลลง Firestore
        await db.collection("transactions").add({
            boxId: boxId,
            userPhone: userPhone,
            type: 'borrow',
            imageUrl: imageUrl,
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("ยืมกล่องสำเร็จ!");
        location.href = 'index.html';
    } catch (error) {
        console.error(error);
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
}

// 4. ฟังก์ชันคืนกล่อง (ส่งข้อมูล + ให้คะแนน)
async function returnBoxWithImage() {
    const boxId = document.getElementById('boxInputReturn').value;
    const imageFile = document.getElementById('imageInputReturn').files[0];
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !imageFile) {
        alert("กรุณาระบุหมายเลขกล่องและถ่ายรูป");
        return;
    }

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

        // ระบบเพิ่มคะแนน (ตัวอย่างเพิ่มทีละ 10 แต้ม)
        let currentPoints = parseInt(localStorage.getItem('userPoints') || 0);
        currentPoints += 10;
        localStorage.setItem('userPoints', currentPoints);

        alert("คืนกล่องสำเร็จ! คุณได้รับ 10 คะแนน");
        location.href = 'index.html';
    } catch (error) {
        alert("เกิดข้อผิดพลาด");
    }
}

// 5. ออกจากระบบ
function logout() {
    localStorage.clear();
    location.href = 'login.html';
}