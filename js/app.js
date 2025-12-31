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

// 3. ฟังก์ชันยืมกล่อง (เปลี่ยนหน้าทันที + อัปโหลดเบื้องหลัง)
async function borrowBackground() {
    const boxId = document.getElementById('boxInput').value;
    const shopName = document.getElementById('shopSelect').value;
    const imageInput = document.getElementById('imageInput');
    const imageFile = imageInput ? imageInput.files[0] : null;
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !shopName || !imageFile) { 
        alert("กรุณากรอกข้อมูลและเลือกรูปภาพให้ครบ"); 
        return; 
    }

    // 🚀 เปลี่ยนหน้าไปหน้าหลักทันที ไม่ต้องรอกด OK
    window.location.href = 'index.html';

    try {
        // ย่อรูปก่อนส่ง (เพื่อให้ไว)
        const compressedFile = await compressImage(imageFile);
        const storageRef = storage.ref(`borrows/${Date.now()}_${boxId}.jpg`);
        
        // อัปโหลดเบื้องหลัง
        storageRef.put(compressedFile).then(async (snapshot) => {
            const imageUrl = await snapshot.ref.getDownloadURL();
            db.collection("transactions").add({
                boxId: boxId,
                shopName: shopName,
                userPhone: userPhone,
                type: 'borrow',
                imageUrl: imageUrl,
                date: new Date().toLocaleString('th-TH'),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
    } catch (e) { console.error(e); }
}

// 4. ฟังก์ชันย่อขนาดรูปภาพ
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

// 5. ฟังก์ชันอื่นๆ (คงเดิม)
async function loadUserData() {
    const userPhone = localStorage.getItem('userPhone');
    if(!userPhone) return;
    const userDoc = await db.collection("users").doc(userPhone).get();
    if (userDoc.exists) {
        const data = userDoc.data();
        const setUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
        setUI('username', data.name);
        setUI('userphone', data.phone);
        setUI('points', data.points || 0);
        setUI('returnCountDisplay', data.returnCount || 0);
    }
}

async function performLogin() {
    const phone = document.getElementById('loginPhone').value;
    const pass = document.getElementById('loginPassword').value;
    const userDoc = await db.collection("users").doc(phone).get();
    if (userDoc.exists && userDoc.data().password === pass) {
        localStorage.setItem('userPhone', phone);
        window.location.replace('index.html');
    } else { alert("ข้อมูลไม่ถูกต้อง"); }
}

function logout() { localStorage.clear(); window.location.replace('login.html'); }
function logout() { localStorage.clear(); window.location.replace('login.html'); }


