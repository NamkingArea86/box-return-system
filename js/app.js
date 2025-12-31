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

// ฟังก์ชันยืมกล่องแบบ "ย่อรูปภาพ" เพื่อความรวดเร็ว
async function borrowBoxWithImage() {
    const boxId = document.getElementById('boxInput').value;
    const imageInput = document.getElementById('imageInput');
    const imageFile = imageInput.files[0];
    const userPhone = localStorage.getItem('userPhone');
    const btnSubmit = document.getElementById('btnSubmit');

    if (!boxId || !imageFile) { 
        alert("กรุณากรอกหมายเลขกล่องและถ่ายรูป"); 
        return; 
    }

    try {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "กำลังย่อรูปและบันทึก...";

        // --- เริ่มขั้นตอนการย่อรูปภาพ ---
        const compressedFile = await compressImage(imageFile);
        // -----------------------------

        // 1. อัปโหลดรูปที่ย่อแล้ว (ไฟล์จะเหลือแค่หลัก KB ทำให้ไวมาก)
        const storageRef = storage.ref(`borrows/${Date.now()}_${boxId}.jpg`);
        await storageRef.put(compressedFile);
        const imageUrl = await storageRef.getDownloadURL();

        // 2. บันทึกข้อมูล
        await db.collection("transactions").add({
            boxId: boxId,
            userPhone: userPhone,
            type: 'borrow',
            imageUrl: imageUrl,
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("ยืมกล่องสำเร็จ!");
        window.location.replace('index.html');
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
        btnSubmit.disabled = false;
        btnSubmit.innerText = "ยืนยันการยืม";
    }
}

// ฟังก์ชันเสริมสำหรับย่อขนาดรูปภาพ (ใส่ไว้ล่างสุดของ app.js)
function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // ตั้งค่าความกว้างสูงสุดแค่ 800px (พอชัดสำหรับดูหลักฐาน)
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7); // คุณภาพรูป 70% (ลดขนาดไฟล์ได้เยอะมาก)
            };
        };
    });
}

// --- ฟังก์ชันการคืน (บวกแต้ม +5) ---
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
            boxId: boxId, userPhone: userPhone, type: 'return',
            imageUrl: imageUrl, date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection("users").doc(userPhone).update({ 
            points: firebase.firestore.FieldValue.increment(5),
            returnCount: firebase.firestore.FieldValue.increment(1)
        });

        alert("คืนกล่องสำเร็จ! ได้รับ 5 แต้ม");
        window.location.replace('index.html');
    } catch (error) { alert("เกิดข้อผิดพลาด"); }
}

// --- ฟังก์ชันอื่นๆ (ลงทะเบียน, ล็อกอิน, โหลดข้อมูล) ---
async function performRegister() {
    const name = document.getElementById('regName').value;
    const faculty = document.getElementById('regFaculty').value;
    const year = document.getElementById('regYear').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;

    const passRegex = /^(?=.*[a-zA-Z])(?=.*[0-9]).{1,10}$/;
    if (!passRegex.test(pass)) { alert("รหัสผ่านต้องมีอักษร+เลข ไม่เกิน 10 ตัว"); return; }
    if (pass !== confirmPass) { alert("รหัสผ่านไม่ตรงกัน"); return; }

    try {
        await db.collection("users").doc(phone).set({
            name, faculty, year, phone, password: pass, points: 0, returnCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        localStorage.setItem('userPhone', phone);
        window.location.replace('index.html');
    } catch (error) { alert(error.message); }
}

async function performLogin() {
    const phone = document.getElementById('loginPhone').value;
    const pass = document.getElementById('loginPassword').value;
    try {
        const userDoc = await db.collection("users").doc(phone).get();
        if (userDoc.exists && userDoc.data().password === pass) {
            localStorage.setItem('userPhone', phone);
            window.location.replace('index.html');
        } else { alert("เบอร์หรือรหัสผ่านผิด"); }
    } catch (error) { alert(error.message); }
}

async function loadUserData() {
    const userPhone = localStorage.getItem('userPhone');
    const userDoc = await db.collection("users").doc(userPhone).get();
    if (userDoc.exists) {
        const data = userDoc.data();
        const setUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
        setUI('username', data.name);
        setUI('userphone', data.phone);
        setUI('userfaculty', data.faculty);
        setUI('useryear', data.year);
        setUI('points', data.points);
        setUI('returnCountDisplay', data.returnCount);
    }
}

async function loadLeaderboard() {
    const body = document.getElementById("leaderboardBody");
    if (!body) return;
    const snapshot = await db.collection("users").orderBy("points", "desc").limit(50).get();
    let html = ""; let rank = 1;
    snapshot.forEach(doc => {
        const u = doc.data();
        html += `<tr><td>${rank++}</td><td><b>${u.name}</b><br><small>${u.phone}</small></td><td align="right"><span class="points-badge">${u.points} แต้ม</span></td></tr>`;
    });
    body.innerHTML = html;
}

async function fetchHistoryFromFirebase(phone) {
    const container = document.getElementById('historyBox');
    if (!container) return;
    const snapshot = await db.collection("transactions").where("userPhone", "==", phone).orderBy("timestamp", "desc").get();
    let html = "";
    snapshot.forEach(doc => {
        const item = doc.data();
        const color = item.type === 'borrow' ? '#4CAF50' : '#FF9800';
        html += `<div class="history-item" style="border-left: 5px solid ${color}; padding:10px; margin-bottom:10px; background:#f9f9f9;">
                    <b>${item.type === 'borrow' ? '📥 ยืม' : '📤 คืน'}</b> <small>${item.date}</small><br>
                    เลขกล่อง: ${item.boxId}
                 </div>`;
    });
    container.innerHTML = html || "ไม่มีประวัติ";
}

function logout() { localStorage.clear(); window.location.replace('login.html'); }
