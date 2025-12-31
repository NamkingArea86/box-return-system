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

// --- ฟังก์ชันยืมกล่อง (Background Upload + Dropdown Shop) ---
// ใช้ชื่อ borrowBackground ตามที่คุณตั้งไว้ใน HTML
async function borrowBackground() {
    const boxId = document.getElementById('boxInput').value;
    const shopName = document.getElementById('shopSelect').value;
    const imageInput = document.getElementById('imageInput');
    const imageFile = imageInput ? imageInput.files[0] : null;
    const userPhone = localStorage.getItem('userPhone');

    // 1. ตรวจสอบข้อมูลเบื้องต้น
    if (!boxId || !shopName || !imageFile) { 
        alert("กรุณากรอกข้อมูล เลือกสถานที่ และเลือกรูปภาพให้ครบ"); 
        return; 
    }

    // 🚀 STEP 2: คำสั่งเปลี่ยนหน้าทันที (ผู้ใช้ไม่ต้องยืนรอนาน)
    alert("กำลังบันทึกข้อมูลเบื้องหลัง คุณสามารถใช้งานส่วนอื่นต่อได้เลย");
    window.location.replace('index.html');

    // STEP 3: ทำงานเบื้องหลัง (ย่อรูป -> อัปโหลด -> บันทึก DB)
    try {
        const compressedFile = await compressImage(imageFile);
        const storageRef = storage.ref(`borrows/${Date.now()}_${boxId}.jpg`);
        
        // อัปโหลดรูป
        const snapshot = await storageRef.put(compressedFile);
        const imageUrl = await snapshot.ref.getDownloadURL();

        // บันทึกข้อมูลลง Firestore
        await db.collection("transactions").add({
            boxId: boxId,
            shopName: shopName,
            userPhone: userPhone,
            type: 'borrow',
            imageUrl: imageUrl,
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("บันทึกการยืมสำเร็จ");
    } catch (error) {
        console.error("Background Error:", error);
    }
}

// ฟังก์ชันเสริม: ย่อขนาดรูปภาพ (ช่วยให้ประหยัดเน็ตและอัปโหลดไว)
function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; // ย่อเหลือ 600px เพื่อความเร็วสูงสุด
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => { resolve(blob); }, 'image/jpeg', 0.6); // คุณภาพ 60%
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
        const compressedFile = await compressImage(imageFile);
        const storageRef = storage.ref(`returns/${Date.now()}_${boxId}.jpg`);
        await storageRef.put(compressedFile);
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
    } catch (error) { alert("เกิดข้อผิดพลาดในการคืน"); }
}

// --- ฟังก์ชันสมาชิก ---
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
        } else { alert("เบอร์หรือรหัสผ่านไม่ถูกต้อง"); }
    } catch (error) { alert(error.message); }
}

async function loadUserData() {
    const userPhone = localStorage.getItem('userPhone');
    if(!userPhone) return;
    try {
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
    } catch (e) { console.error(e); }
}

async function loadLeaderboard() {
    const body = document.getElementById("leaderboardBody");
    if (!body) return;
    try {
        const snapshot = await db.collection("users").orderBy("points", "desc").limit(50).get();
        let html = ""; let rank = 1;
        snapshot.forEach(doc => {
            const u = doc.data();
            html += `<tr><td>${rank++}</td><td><b>${u.name}</b><br><small>${u.phone}</small></td><td align="right"><span class="points-badge">${u.points} แต้ม</span></td></tr>`;
        });
        body.innerHTML = html;
    } catch (e) { console.error(e); }
}

async function fetchHistoryFromFirebase(phone) {
    const container = document.getElementById('historyBox');
    if (!container) return;
    try {
        const snapshot = await db.collection("transactions").where("userPhone", "==", phone).orderBy("timestamp", "desc").get();
        let html = "";
        snapshot.forEach(doc => {
            const item = doc.data();
            const color = item.type === 'borrow' ? '#4CAF50' : '#FF9800';
            html += `<div class="history-item" style="border-left: 5px solid ${color}; padding:10px; margin-bottom:10px; background:#f9f9f9; border-radius: 8px;">
                        <b>${item.type === 'borrow' ? '📥 ยืม' : '📤 คืน'}</b> <small>${item.date}</small><br>
                        เลขกล่อง: ${item.boxId} | ร้าน: ${item.shopName || '-'}
                     </div>`;
        });
        container.innerHTML = html || "ไม่มีประวัติ";
    } catch (e) { console.error(e); }
}

function logout() { localStorage.clear(); window.location.replace('login.html'); }
