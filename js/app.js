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

// 3. ฟังก์ชันลงทะเบียน (เพิ่มรหัสนักศึกษา 10 หลัก)
async function performRegister() {
    const name = document.getElementById('regName').value;
    const studentId = document.getElementById('regStudentId').value;
    const faculty = document.getElementById('regFaculty').value;
    const year = document.getElementById('regYear').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;

    if (!name || !studentId || !faculty || !year || !phone || !pass) { 
        alert("กรุณากรอกข้อมูลให้ครบทุกช่อง"); return; 
    }

    if (studentId.length !== 10) {
        alert("รหัสนักศึกษาต้องมี 10 หลัก"); return;
    }

    const passRegex = /^(?=.*[a-zA-Z])(?=.*[0-9]).{1,10}$/;
    if (!passRegex.test(pass)) { 
        alert("รหัสผ่านต้องมีอักษร+เลข ไม่เกิน 10 ตัว"); return; 
    }

    if (pass !== confirmPass) { alert("รหัสผ่านไม่ตรงกัน"); return; }

    try {
        await db.collection("users").doc(phone).set({
            name, studentId, faculty, year, phone, password: pass,
            points: 0, returnCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        localStorage.setItem('userPhone', phone);
        alert("ลงทะเบียนสำเร็จ!");
        window.location.replace('index.html');
    } catch (e) { alert(e.message); }
}

// 4. ฟังก์ชันยืมกล่อง (Background Upload)
async function borrowBackground() {
    const boxId = document.getElementById('boxInput').value;
    const shopName = document.getElementById('shopSelect').value;
    const imageInput = document.getElementById('imageInput');
    const imageFile = imageInput ? imageInput.files[0] : null;
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !shopName || !imageFile) { 
        alert("กรุณากรอกข้อมูลและเลือกรูปภาพให้ครบ"); return; 
    }

    window.location.href = 'index.html'; // ไปหน้าหลักทันที

    try {
        const compressedFile = await compressImage(imageFile);
        const storageRef = storage.ref(`borrows/${Date.now()}_${boxId}.jpg`);
        
        storageRef.put(compressedFile).then(async (snapshot) => {
            const imageUrl = await snapshot.ref.getDownloadURL();
            db.collection("transactions").add({
                boxId, shopName, userPhone, type: 'borrow', imageUrl,
                date: new Date().toLocaleString('th-TH'),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
    } catch (e) { console.error(e); }
}

// 5. ฟังก์ชันคืนกล่อง
async function returnBoxWithImage() {
    const boxId = document.getElementById('boxInputReturn').value;
    const imageFile = document.getElementById('imageInputReturn').files[0];
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !imageFile) { alert("กรุณาระบุข้อมูลให้ครบ"); return; }

    window.location.href = 'index.html';

    try {
        const compressedFile = await compressImage(imageFile);
        const storageRef = storage.ref(`returns/${Date.now()}_${boxId}.jpg`);
        
        storageRef.put(compressedFile).then(async (snapshot) => {
            const imageUrl = await snapshot.ref.getDownloadURL();
            await db.collection("transactions").add({
                boxId, userPhone, type: 'return', imageUrl,
                date: new Date().toLocaleString('th-TH'),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection("users").doc(userPhone).update({ 
                points: firebase.firestore.FieldValue.increment(5),
                returnCount: firebase.firestore.FieldValue.increment(1)
            });
        });
    } catch (e) { console.error(e); }
}

// 6. ฟังก์ชันย่อขนาดรูปภาพ
function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => { resolve(blob); }, 'image/jpeg', 0.6);
            };
        };
    });
}

// 7. โหลดข้อมูลผู้ใช้
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
            setUI('userid', data.studentId); // แสดงรหัสนักศึกษา
            setUI('userfaculty', data.faculty);
            setUI('useryear', data.year);
            setUI('points', data.points || 0);
            setUI('returnCountDisplay', data.returnCount || 0);
        }
    } catch (e) { console.error(e); }
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
    } catch (e) { alert(e.message); }
}

function logout() { localStorage.clear(); window.location.replace('login.html'); }
