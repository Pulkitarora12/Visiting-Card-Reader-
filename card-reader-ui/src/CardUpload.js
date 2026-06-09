import React, { useState ,useRef, useCallback} from "react";
import axios from "axios";
import Webcam from "react-webcam";



function CardUpload({ authToken, currentUser, onLogout }) {
  const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

  const authConfig = {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  };

  const [file, setFile] = useState(null);
  const [data, setData] = useState({
    primary_owner: "",
    primary_company: "",
    emails: "",
    phone_numbers: "",
    address: ""
  });
  const [loading, setLoading] = useState(false);
  const [isExtracted, setIsExtracted] = useState(false);
  
  //state to fetch the db 
  const [databaseRecords, setDatabaseRecords] = useState([]);
  const [showDatabase, setShowDatabase] = useState(false);

  // New state variables for OTP pending approvals
  const [pendingUsers, setPendingUsers] = useState([]);
  const [showPendingApprovals, setShowPendingApprovals] = useState(false);
  const [otpInputs, setOtpInputs] = useState({});
  const [verifyingUser, setVerifyingUser] = useState(null);

  // new state for camera
  const[sourceType , setSourceType] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false); //preview the clicked photo
  const [facingMode, setFacingMode] = useState("environment"); // to toggle camera facing mode
  const webcamRef = useRef(null);

  // 1. Reset Function to process a new card
  const handleReset = () => {
    setFile(null);
    setData({
      primary_owner: "",
      primary_company: "",
      emails: "",
      phone_numbers: "",
      address: ""
    });
    setIsExtracted(false);
    setSourceType(null);
    setIsPreviewing(false);
    setLoading(false);
    setShowDatabase(false);
    setShowPendingApprovals(false);
  };
  const toggleCamera = () => {
    setFacingMode((prevMode) => (prevMode === "user" ? "environment" : "user"));
  };
  // Function to capture image 
  const capture = useCallback(()=>{
    const imageSrc = webcamRef.current.getScreenshot();
    fetch(imageSrc)
      .then(res => res.blob())
      .then(blob => {
        const capturedFile = new File([blob] ,"webcam_snap.jpg", {type: 'image/jpeg'});
        setFile(capturedFile);
        setIsPreviewing(true);
      });
  } , [webcamRef]);

  // 2. Extract data from the uploaded image
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE_URL}/extract`, formData, authConfig);
      const resData = response.data.data;
      
      // Map data to state for editing
      setData({
        primary_owner: resData.primary_owner || "",
        primary_company: resData.primary_company || "",
        emails: resData.emails?.join(", ") || "",
        phone_numbers: resData.phone_numbers?.join(", ") || "",
        address: resData.address || ""
      });
      setIsExtracted(true);
    } catch (error) {
      console.error("Extraction failed", error);
      alert("Failed to extract data. Please check your backend.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Save Function for edited data
  const handleSaveToDatabase = async () => {
    try {
      await axios.post(`${API_BASE_URL}/save`, data, authConfig);
      alert("✅ Data saved to Database successfully!");
    } catch (error) {
      console.error("Save failed", error);
      alert("❌ Failed to save data.");
    }
  };
  // 4. Fetch all saved cards from the database
  const handleViewDatabase = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/cards`, authConfig);
      setDatabaseRecords(response.data.data);
      setShowDatabase(true); // Switch the view to show the table
      setShowPendingApprovals(false); // Close approvals
    } catch (error) {
      console.error("Failed to fetch database", error);
      alert("Could not load database records.");
    }
  }; 

  const handleViewPendingApprovals = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/pending-users`, authConfig);
      setPendingUsers(response.data.data);
      setShowPendingApprovals(true);
      setShowDatabase(false);
    } catch (error) {
      console.error("Failed to fetch pending users", error);
      alert("Could not load pending registrations.");
    }
  };

  const handleVerifyUser = async (username) => {
    const otp = otpInputs[username];
    if (!otp || otp.trim().length !== 6) {
      alert("Please enter a valid 6-digit OTP.");
      return;
    }

    setVerifyingUser(username);
    try {
      await axios.post(`${API_BASE_URL}/admin/verify-user`, {
        username: username,
        otp: otp.trim()
      }, authConfig);
      
      alert(`✅ User '${username}' successfully verified and activated!`);
      setPendingUsers(pendingUsers.filter(u => u.username !== username));
      setOtpInputs(prev => {
        const copy = { ...prev };
        delete copy[username];
        return copy;
      });
    } catch (error) {
      console.error("Failed to verify user", error);
      alert(error.response?.data?.detail || "Verification failed. Invalid OTP.");
    } finally {
      setVerifyingUser(null);
    }
  };

  const handleDownloadAll = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/download-all`, {
        responseType: "blob",
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "all_business_cards.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download database", error);
      alert("Could not download database.");
    }
  };
  const handleDownloadSingle = (record) => {
    // Format the data as a CSV string
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Owner,Company,Email,Phone,Address\n"
      + `"${record.owner_name}","${record.company_name}","${record.emails}","${record.phone_numbers}","${record.address}"`;
    
    // Create a hidden link and trigger the download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    // Name the file based on the owner's name
    const fileName = record.owner_name ? record.owner_name.replace(/\s+/g, '_') : 'contact';
    link.setAttribute("download", `${fileName}_card.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id) => {
    // Add a quick confirmation popup so you don't delete by accident
    if (!window.confirm("Are you sure you want to delete this card?")) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/cards/${id}`, authConfig);
      // Remove the deleted card from the screen without reloading the page
      setDatabaseRecords(databaseRecords.filter(record => record.id !== id));
    } catch (error) {
      console.error("Failed to delete", error);
      alert("Failed to delete the card.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 md:mb-10">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-gray-100 mb-6">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight text-center sm:text-left">
              Accosoft Solution - Card Reader
            </h1>
            {currentUser && (
              <div className="flex items-center gap-3">
                <span className="text-xs md:text-sm text-gray-500 font-semibold bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                  👤 {currentUser.username}
                </span>
                <button 
                  onClick={onLogout} 
                  className="bg-red-50 text-red-600 px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-red-100 transition shadow-sm"
                >
                  Logout ➔
                </button>
              </div>
            )}
          </div>
          {/* Admin Navigation Tabs */}
          {currentUser && currentUser.role === "admin" && (
            <div className="flex flex-wrap justify-center gap-3 mb-6 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm">
              <button 
                onClick={handleReset} 
                className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
                  !showDatabase && !showPendingApprovals 
                    ? "bg-blue-600 text-white shadow-md" 
                    : "bg-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                📷 Scan Card
              </button>
              <button 
                onClick={handleViewDatabase} 
                className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
                  showDatabase 
                    ? "bg-blue-600 text-white shadow-md" 
                    : "bg-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                🗄️ View Database
              </button>
              <button 
                onClick={handleViewPendingApprovals} 
                className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
                  showPendingApprovals 
                    ? "bg-blue-600 text-white shadow-md" 
                    : "bg-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                🔑 Pending Approvals
              </button>
            </div>
          )}

          {isExtracted && !showDatabase && !showPendingApprovals && (
            <div className="text-center">
              <button onClick={handleReset} className="text-blue-500 hover:text-blue-700 underline transition text-sm font-semibold">
                ← Upload New Card
              </button>
            </div>
          )}
        </header>

        {/* 1. CHOICE MENU */}
        {/* 1. CHOICE MENU */}
        {!showDatabase && !showPendingApprovals && !isExtracted && !sourceType && (
          <div className="bg-white p-6 md:p-10 rounded-2xl shadow-xl text-center border border-gray-100 animate-fade-in">
            <h2 className="text-xl md:text-2xl font-bold mb-6 md:mb-8 text-gray-700">How would you like to start?</h2>
            
            <div className="flex flex-col md:flex-row gap-4 md:gap-8 justify-center">
              <button onClick={() => setSourceType('file')} className="group flex-1 bg-blue-50 py-6 md:py-10 rounded-2xl border-2 border-blue-100 hover:border-blue-400 hover:bg-white transition-all flex flex-col items-center gap-4 shadow-sm hover:shadow-md">
                <span className="text-4xl md:text-5xl transition-transform group-hover:scale-110">📁</span>
                <span className="font-bold text-blue-700 text-base md:text-lg uppercase">Upload File</span>
              </button>
              
              <button onClick={() => setSourceType('camera')} className="group flex-1 bg-purple-50 py-6 md:py-10 rounded-2xl border-2 border-purple-100 hover:border-purple-400 hover:bg-white transition-all flex flex-col items-center gap-4 shadow-sm hover:shadow-md">
                <span className="text-4xl md:text-5xl transition-transform group-hover:scale-110">📸</span>
                <span className="font-bold text-purple-700 text-base md:text-lg uppercase">Take Photo</span>
              </button>
            </div>

            {/* --- NEW CENTERED VIEW DATABASE & DOWNLOAD BUTTONS (Admin Only) --- */}
            {currentUser && currentUser.role === "admin" && (
              <>
                <div className="mt-10 pt-8 border-t border-gray-100 flex flex-wrap gap-4 justify-center items-center">
                  <button 
                    onClick={handleViewDatabase} 
                    className="inline-flex items-center gap-2 bg-gray-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-black hover:scale-105 transition shadow-lg active:scale-95"
                  >
                    🗄️ View Existing Database
                  </button>
                  <button 
                    onClick={handleViewPendingApprovals} 
                    className="inline-flex items-center gap-2 bg-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-purple-700 hover:scale-105 transition shadow-lg active:scale-95 text-sm"
                  >
                    🔑 Pending Approvals
                  </button>
                  <button 
                    onClick={handleDownloadAll}
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 hover:scale-105 transition shadow-lg active:scale-95 text-sm"
                  >
                    📥 Download Full DB (.csv)
                  </button>
                </div>
                <p className="text-gray-400 text-sm mt-3">Access, manage, or approve user registrations</p>
              </>
            )}
          </div>
        )}
        {/* 2. CAMERA INTERFACE: With Switch Toggle */}
        {!showDatabase && !showPendingApprovals && !isExtracted && sourceType === 'camera' && !isPreviewing && (
          <div className="bg-white p-4 md:p-8 rounded-2xl shadow-lg text-center border border-gray-100 animate-fade-in">
            <div className="relative inline-block overflow-hidden rounded-xl border-4 border-gray-100 mb-6 shadow-inner w-full max-w-md">
              <Webcam 
                audio={false} 
                ref={webcamRef} 
                screenshotFormat="image/jpeg" 
                videoConstraints={{ facingMode: facingMode }} // Dynamic Facing Mode
                className="w-full mx-auto" 
              />
              {/* Floating Switch Camera Button */}
              <button 
                onClick={toggleCamera}
                className="absolute top-4 right-4 bg-white/80 p-2 rounded-full shadow-md hover:bg-white transition"
                title="Switch Camera"
              >
                🔄
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <button onClick={capture} className="w-full sm:w-auto bg-red-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-600 shadow-lg active:scale-95 transition">Snap Photo</button>
              <button onClick={() => setSourceType(null)} className="w-full sm:w-auto bg-gray-200 text-gray-700 px-8 py-3 rounded-xl font-bold hover:bg-gray-300 transition">Back</button>
            </div>
            <p className="mt-4 text-xs text-gray-400">Current: {facingMode === "user" ? "Front Camera" : "Back Camera"}</p>
          </div>
        )}

        {/* 3. SNAPSHOT PREVIEW */}
        {!showDatabase && !showPendingApprovals && !isExtracted && isPreviewing && (
          <div className="bg-white p-4 md:p-8 rounded-2xl shadow-lg text-center border-2 border-blue-50 animate-fade-in">
            <h3 className="text-lg md:text-xl font-bold text-gray-700 mb-6">Confirm Captured Photo</h3>
            <div className="inline-block overflow-hidden rounded-xl border-4 border-white shadow-md mb-6 w-full max-w-md">
              <img src={URL.createObjectURL(file)} alt="Snapped" className="w-full rounded-lg" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <button onClick={handleUpload} disabled={loading} className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg active:scale-95 transition">
                {loading ? "Processing..." : "Extract Data"}
              </button>
              <button onClick={() => { setIsPreviewing(false); setFile(null); }} className="w-full sm:w-auto bg-gray-200 text-gray-700 px-8 py-3.5 rounded-xl font-bold hover:bg-gray-300 transition">
                Retake Photo
              </button>
            </div>
          </div>
        )}

        {/* 4. UPLOAD SECTION */}
        {!showDatabase && !showPendingApprovals && !isExtracted && sourceType === 'file' && (
          <div className="bg-white p-4 md:p-8 rounded-2xl shadow-lg mb-6 border border-gray-100 animate-fade-in">
            <h3 className="text-base md:text-lg font-bold text-gray-700 mb-4">Upload card image</h3>
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} className="w-full border-2 border-dashed border-gray-300 rounded-xl p-3 md:p-4 cursor-pointer hover:border-blue-400 transition text-sm" />
              <button onClick={handleUpload} disabled={loading || !file} className={`w-full sm:w-auto px-8 py-3.5 rounded-xl text-white font-bold transition shadow-md ${loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}>
                {loading ? "Reading..." : "Extract Data"}
              </button>
            </div>
            <button onClick={() => setSourceType(null)} className="mt-6 text-gray-500 hover:text-gray-800 font-medium flex items-center gap-2 text-sm">← Back to Menu</button>
          </div>
        )}

        {/* 5. RESULT SECTION */}
        {!showDatabase && !showPendingApprovals && isExtracted && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 animate-fade-in">
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-md flex flex-col h-full border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">🖼️ Card Preview</h3>
              <div className="flex-grow flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 overflow-hidden shadow-inner min-h-[200px]">
                <img src={URL.createObjectURL(file)} alt="Card" className="rounded-lg max-h-full w-auto p-2" />
              </div>
              
              {currentUser && currentUser.role === "admin" && (
                <>
                  <button onClick={handleViewDatabase} className="mt-4 md:mt-6 w-full bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-black transition shadow-lg flex items-center justify-center gap-2 text-sm md:text-base"> 
                     🗄️ View Database 
                  </button>
                  <button 
                    onClick={handleDownloadAll}
                    className="mt-3 md:mt-4 w-full bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-black transition shadow-lg flex items-center justify-center gap-2 text-sm md:text-base"
                  >
                     Download Full DB (.csv)
                  </button>
                </>
              )}
            </div>

            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-md flex flex-col h-full border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">📝 Edit Details</h3>
              <div className="space-y-3 md:space-y-4 flex-grow">
                {["primary_owner", "primary_company", "emails", "phone_numbers"].map((key) => (
                  <div key={key}>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">{key.replace('_', ' ')}</label>
                    <input type="text" value={data[key]} onChange={(e) => setData({...data, [key]: e.target.value})} className="w-full border-gray-200 bg-gray-50 border p-2.5 md:p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition text-sm" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Address</label>
                  <textarea value={data.address} onChange={(e) => setData({...data, address: e.target.value})} className="w-full border-gray-200 bg-gray-50 border p-2.5 md:p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition text-sm" rows="3" />
                </div>
                <button onClick={handleSaveToDatabase} className="w-full bg-green-500 text-white py-3.5 md:py-4 rounded-xl font-bold hover:bg-green-600 shadow-lg active:scale-95 transition mt-4 text-sm md:text-base"> Save to Database</button>
              </div>
            </div>
          </div>
        )}
         {/* 6. DATABASE VIEWER SECTION */}
        {showDatabase && (
          <div className="mt-8 md:mt-12 bg-white p-4 md:p-8 rounded-2xl shadow-xl border border-gray-100 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">Saved Business Cards</h2>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button 
                  onClick={handleDownloadAll}
                  className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold hover:bg-green-700 transition flex items-center gap-1.5 shadow"
                >
                  📥 Download Full DB (.csv)
                </button>
                <button onClick={() => setShowDatabase(false)} className="text-gray-500 hover:text-red-500 font-bold text-sm md:text-base">
                  Close Viewer ✖
                </button>
              </div>
            </div>
            
            {/* Mobile-optimized Card List view (shown on small screens) */}
            <div className="block md:hidden space-y-4">
              {databaseRecords.length === 0 ? (
                <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl">No cards saved yet.</div>
              ) : (
                databaseRecords.map((record) => (
                  <div key={record.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm relative">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-gray-950 text-base">{record.owner_name}</h4>
                        <p className="text-xs text-gray-500 font-semibold">{record.company_name}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleDownloadSingle(record)} 
                          className="bg-blue-100 text-blue-700 p-2 rounded-lg hover:bg-blue-200 transition text-sm font-bold flex items-center justify-center w-8 h-8"
                          title="Download CSV"
                        >
                          ⬇️
                        </button>
                        <button 
                          onClick={() => handleDelete(record.id)} 
                          className="bg-red-100 text-red-700 p-2 rounded-lg hover:bg-red-200 transition text-sm font-bold flex items-center justify-center w-8 h-8"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs text-gray-700 pt-3 border-t border-gray-200/50">
                      {record.emails && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">📧</span>
                           <a href={`mailto:${record.emails}`} className="text-blue-600 break-all underline">{record.emails}</a>
                        </div>
                      )}
                      {record.phone_numbers && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">📞</span>
                          <span className="break-all font-medium">{record.phone_numbers}</span>
                        </div>
                      )}
                      {record.address && (
                        <div className="flex items-start gap-2 text-gray-500">
                          <span className="text-gray-400 mt-0.5">📍</span>
                          <span className="break-words">{record.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table view (shown on md screens and up) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
                    <th className="p-4 rounded-tl-lg">Owner</th>
                    <th className="p-4">Company</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Address</th>
                    <th className="p-4 rounded-tr-lg text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-700">
                  {databaseRecords.length === 0 ? (
                    <tr><td colSpan="6" className="p-6 text-center text-gray-400">No cards saved yet.</td></tr>
                  ) : (
                    databaseRecords.map((record) => (
                      <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="p-4 font-bold text-gray-900">{record.owner_name}</td>
                        <td className="p-4">{record.company_name}</td>
                        <td className="p-4 text-blue-600">{record.emails}</td>
                        <td className="p-4">{record.phone_numbers}</td>
                        <td className="p-4 text-xs">{record.address}</td>
                        <td className="p-4 flex gap-2 justify-center">
                          <button 
                            onClick={() => handleDownloadSingle(record)} 
                            className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition text-xs font-bold"
                            title="Download CSV"
                          >
                            ⬇️
                          </button>
                          <button 
                            onClick={() => handleDelete(record.id)} 
                            className="bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition text-xs font-bold"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. PENDING APPROVALS SECTION */}
        {showPendingApprovals && (
          <div className="mt-8 md:mt-12 bg-white p-4 md:p-8 rounded-2xl shadow-xl border border-gray-100 animate-fade-in">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">Pending Registrations</h2>
              <button onClick={() => setShowPendingApprovals(false)} className="text-gray-500 hover:text-red-500 font-bold text-sm md:text-base">
                Close Viewer ✖
              </button>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="p-10 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <span className="text-4xl mb-3 block">🎉</span>
                <p className="font-semibold text-gray-600">All registered users are verified!</p>
                <p className="text-sm text-gray-400 mt-1">There are no pending registrations requiring approval.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="bg-gray-50 p-4 md:p-6 rounded-xl border border-gray-150 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-gray-900 text-base md:text-lg flex items-center gap-2">
                        👤 {user.username}
                      </h4>
                      <p className="text-sm text-blue-600 font-medium">{user.email}</p>
                      <p className="text-xs text-gray-400 mt-1">Registered: {new Date(user.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <input 
                        type="text" 
                        maxLength="6"
                        placeholder="OTP Code"
                        value={otpInputs[user.username] || ""}
                        onChange={(e) => setOtpInputs({
                          ...otpInputs,
                          [user.username]: e.target.value
                        })}
                        className="border-gray-200 bg-white border px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold tracking-widest text-sm w-32"
                        disabled={verifyingUser === user.username}
                      />
                      <button
                        onClick={() => handleVerifyUser(user.username)}
                        disabled={verifyingUser === user.username}
                        className="bg-green-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-green-700 transition shadow-md disabled:bg-gray-400 text-xs md:text-sm flex-grow md:flex-grow-0 min-h-[40px]"
                      >
                        {verifyingUser === user.username ? "Verifying..." : "Verify & Approve"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CardUpload;