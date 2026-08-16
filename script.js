// 🌟 പുതിയ സിലബസ് Apps Script Web App URL ഇവിടെ ചേർക്കുക
const GAS_SYLLABUS_API_URL = "https://script.google.com/macros/s/AKfycbxBjDa7qx14XCMOK-ndIdxukYiFE_AkwjsY7ojSZtGVQQUtGo24_OE6UvqSniJ9kD5i/exec";

// API Fetcher Client
function callSyllabusGAS(action, payload, successCallback, failureCallback) {
  const reqData = Object.assign({ action: action }, payload);
  fetch(GAS_SYLLABUS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(reqData)
  })
  .then(res => res.json())
  .then(data => { if (successCallback) successCallback(data); })
  .catch(err => { if (failureCallback) failureCallback(err); else console.error("Syllabus API Error:", err); });
}

const urlParams = new URLSearchParams(window.location.search);
const urlUser = urlParams.get('u') || "";
const urlToken = urlParams.get('t') || "";

let allData = [];
let loggedInStream = "";
let isUserAdmin = false;
let activeBackupRows = {}; 

window.addEventListener('DOMContentLoaded', (event) => {
  checkAutomaticLogin();
});

function checkAutomaticLogin() {
  if (urlUser && urlToken && urlUser !== "null" && urlUser !== "") {
    let loginSection = document.getElementById('loginSection');
    
    loginSection.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary mb-3" style="color: #1e3c72 !important;" role="status"></div>
        <h5 class="fw-bold" style="color: #1e3c72;">Securing Connection...</h5>
        <p class="text-muted small">Auto-Authenticating with SNEC Portal</p>
      </div>
    `;
    
    callSyllabusGAS("loginWithToken", { username: urlUser, token: urlToken }, function(response) {
      if(response.success) {
        localStorage.setItem('snec_user_session', JSON.stringify(response));
        applyLoginData(response);
        callSyllabusGAS("logVisit", { teacherId: response.username, name: response.name, stream: response.stream });
      } else {
        showNormalLogin(); 
      }
    });
    return;
  }

  let savedSession = localStorage.getItem('snec_user_session');
  if (savedSession) {
    try {
      let response = JSON.parse(savedSession);
      applyLoginData(response);
    } catch(e) {
      localStorage.removeItem('snec_user_session');
      showNormalLogin();
    }
  } else {
    showNormalLogin(); 
  }
}

function showNormalLogin() {
  let loginSection = document.getElementById('loginSection');
  loginSection.innerHTML = `
    <div class="text-center mb-4">
      <h5 class="fw-bold text-dark m-0">SAMASTHA NATIONAL EDUCATION COUNCIL</h5>
      <small class="text-muted fw-bold">Syllabus Ledger Secure Gateway</small>
    </div>
    <div id="loginError" class="alert alert-danger d-none" role="alert"></div>
    <div class="mb-3">
      <label class="form-label fw-semibold text-secondary">ID Credentials</label>
      <input type="text" id="teacherId" class="form-control" placeholder="Enter ID">
    </div>
    <div class="mb-4">
      <label class="form-label fw-semibold text-secondary">Password</label>
      <input type="password" id="password" class="form-control" placeholder="Enter Password">
    </div>
    <button class="btn btn-capsule-primary w-100" onclick="attemptLogin()" id="loginBtn"><i class="fa-solid fa-unlock"></i>Access Ledger Portal</button>
  `;
  loginSection.style.display = 'block';
}

function attemptLogin() {
  let id = document.getElementById('teacherId').value.trim();
  let pass = document.getElementById('password').value.trim();
  let errorDiv = document.getElementById('loginError');
  let btn = document.getElementById('loginBtn');
  
  if(!id || !pass) {
    errorDiv.innerText = "Please enter both ID Credentials and Password!";
    errorDiv.classList.remove('d-none');
    return;
  }
  
  btn.disabled = true;
  btn.innerText = "Verifying Credentials...";
  errorDiv.classList.add('d-none');
  
  callSyllabusGAS("loginTeacher", { teacherId: id, password: pass }, function(response) {
    if(response.success) {
      localStorage.setItem('snec_user_session', JSON.stringify(response));
      applyLoginData(response);
      callSyllabusGAS("logVisit", { teacherId: response.username, name: response.name, stream: response.stream });
    } else {
      errorDiv.innerText = response.message;
      errorDiv.classList.remove('d-none');
      btn.disabled = false;
      btn.innerHTML = "<i class='fa-solid fa-unlock'></i>Access Ledger Portal";
    }
  });
}

function applyLoginData(response) {
  loggedInStream = response.stream;
  isUserAdmin = response.isAdmin;
  document.getElementById('userDisplay').innerText = response.name;
  
  if(isUserAdmin) {
    document.getElementById('streamBadgeArea').style.display = 'none';
    document.getElementById('adminStreamFilterCol').classList.remove('d-none');
    document.getElementById('adminSubNameFilterCol').classList.remove('d-none');
    document.getElementById('excelBtn').classList.remove('d-none');
    document.getElementById('actionHeader').classList.remove('d-none');
    document.getElementById('adminNotice').classList.remove('d-none');
    document.getElementById('yearFilterCol').className = "col-md-3";
    document.getElementById('classFilterCol').className = "col-md-3";
  } else {
    document.getElementById('streamDisplay').innerText = response.stream;
    document.getElementById('adminStreamFilterCol').classList.add('d-none');
    document.getElementById('adminSubNameFilterCol').classList.add('d-none');
    document.getElementById('excelBtn').classList.add('d-none');
    document.getElementById('actionHeader').classList.add('d-none');
    document.getElementById('adminNotice').classList.add('d-none');
    document.getElementById('yearFilterCol').className = "col-md-6";
    document.getElementById('classFilterCol').className = "col-md-6";
  }
  
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('portalSection').style.display = 'block';
  
  loadDatabase();
}

function logoutUser() {
  try {
    localStorage.removeItem('snec_user_session');
    sessionStorage.removeItem('snec_data_cache');
    sessionStorage.removeItem('snec_data_cache_ts');
  } catch(e) {}
  window.location.reload();
}

var SESSION_DATA_KEY = 'snec_data_cache';
var SESSION_DATA_TS   = 'snec_data_cache_ts';
var SESSION_TTL_MS   = 5 * 60 * 1000; 

function loadDatabase(forceRefresh) {
  if (!forceRefresh) {
    try {
      var raw = sessionStorage.getItem(SESSION_DATA_KEY);
      var ts  = parseInt(sessionStorage.getItem(SESSION_DATA_TS) || '0', 10);
      var age = Date.now() - ts;
      if (raw && age < SESSION_TTL_MS) {
        allData = JSON.parse(raw);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('portal-content').style.display = 'block';
        setLastUpdatedTime();
        populateYears();
        debouncedPopulateSubjects();
        _silentBackgroundRefresh();
        return; 
      }
    } catch(e) { }
  }

  document.getElementById('loading').style.display = 'block';
  document.getElementById('portal-content').style.display = 'none';

  callSyllabusGAS("getSheetData", { forceRefresh: forceRefresh || false }, function(data) {
    allData = data;
    _saveToSessionCache(data);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('portal-content').style.display = 'block';
    setLastUpdatedTime();
    populateYears();
    debouncedPopulateSubjects();
    if (typeof window._dbLoadCallback === 'function') window._dbLoadCallback();
  });
}

function _saveToSessionCache(data) {
  try {
    sessionStorage.setItem(SESSION_DATA_KEY, JSON.stringify(data));
    sessionStorage.setItem(SESSION_DATA_TS,  Date.now().toString());
  } catch(e) { }
}

function _silentBackgroundRefresh() {
  callSyllabusGAS("getSheetData", { forceRefresh: false }, function(freshData) {
    if (!freshData || freshData.length === 0) return;
    _saveToSessionCache(freshData);
    var oldJson = JSON.stringify(allData);
    var newJson = JSON.stringify(freshData);
    if (oldJson !== newJson) {
      allData = freshData;
      populateYears();
      debouncedPopulateSubjects();
      if (document.getElementById('classSelect').value) showSyllabus();
      setLastUpdatedTime();
    }
  });
}

function refreshData() {
  let refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = "<i class='fa-solid fa-arrows-rotate'></i>Refreshing...";
  loadDatabase(true);
  
  let _origOnLoad = window._dbLoadCallback;
  window._dbLoadCallback = function() {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = "<i class='fa-solid fa-arrows-rotate'></i>Refresh Database";
    if (document.getElementById('classSelect').value) showSyllabus();
    window._dbLoadCallback = _origOnLoad;
  };
}

function setLastUpdatedTime() {
  let now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  let ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  document.getElementById('lastUpdatedTime').innerText = hours + ':' + minutes + ' ' + ampm + ' (Today)';
}

function populateYears() {
  let currentSel = document.getElementById('yearSelect').value;
  let filteredForYears = allData;
  
  if (!isUserAdmin) {
    filteredForYears = allData.filter(item => String(item['STREAM']).toLowerCase() === loggedInStream.toLowerCase());
  }
  
  let years = [...new Set(filteredForYears.map(item => item['AC YEAR']))] .filter(Boolean).sort();
  let select = document.getElementById('yearSelect');
  select.innerHTML = '<option value="">Select Academic Year</option>';
  if(isUserAdmin) select.innerHTML += '<option value="ALL">ALL (All-Time Record)</option>';
  
  years.forEach(y => {
    let opt = document.createElement('option');
    opt.value = y; opt.textContent = y; select.appendChild(opt);
  });
  if(currentSel) select.value = currentSel;
}

let _subjectsDebounceTimer = null;
function debouncedPopulateSubjects() {
  clearTimeout(_subjectsDebounceTimer);
  _subjectsDebounceTimer = setTimeout(populateDependentSubjects, 50);
}

function populateDependentSubjects() {
  let year = document.getElementById('yearSelect').value;
  let currentActiveStream = isUserAdmin ? document.getElementById('adminStreamSelect').value : loggedInStream;
  let className = document.getElementById('classSelect').value;
  let subjectSelect = document.getElementById('adminSubNameSelect');
  
  if (!subjectSelect) return;
  
  let filteredForSubs = allData.filter(item => {
    let match = true;
    if (year && year !== "ALL") match = match && (item['AC YEAR'] == year);
    if (currentActiveStream && currentActiveStream !== "ALL") match = match && (String(item['STREAM']).toLowerCase() === currentActiveStream.toLowerCase());
    if (className && className !== "ALL") match = match && (item['CLASS'] == className);
    return match;
  });
  
  let uniqueSubs = [...new Set(filteredForSubs.map(item => item['SUBJECTS'] ? item['SUBJECTS'].toString().trim() : ''))].filter(Boolean).sort();
  
  let currentSelectedSub = subjectSelect.value;
  subjectSelect.innerHTML = '<option value="ALL">ALL SUBJECTS (Default)</option>';
  
  uniqueSubs.forEach(s => {
    let opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    subjectSelect.appendChild(opt);
  });
  
  if (uniqueSubs.includes(currentSelectedSub)) {
    subjectSelect.value = currentSelectedSub;
  } else {
    subjectSelect.value = "ALL";
  }
}

function updateDropdowns(level) {
  let year = document.getElementById('yearSelect').value;
  let streamSel = document.getElementById('adminStreamSelect');
  let classSel = document.getElementById('classSelect');

  if (level === 'year') {
    document.getElementById('tableContainer').style.display = 'none';
    if (!year) {
      if(isUserAdmin) resetSelect(streamSel, 'Select Stream');
      resetSelect(classSel, 'Select Class');
      return;
    }
    
    if (isUserAdmin) {
      resetSelect(classSel, 'Select Class');
      let yearFiltered = (year === "ALL") ? allData : allData.filter(item => item['AC YEAR'] == year);
      let streams = [...new Set(yearFiltered.map(item => item['STREAM']))].filter(Boolean);
      streamSel.innerHTML = '<option value="">Select Stream</option>';
      streamSel.innerHTML += '<option value="ALL">ALL STREAMS</option>';
      streams.forEach(s => addOption(streamSel, s));
      streamSel.disabled = false;
    } else {
      resetSelect(classSel, 'Select Class');
      let filtered = allData.filter(item => item['AC YEAR'] == year && String(item['STREAM']).toLowerCase() === loggedInStream.toLowerCase());
      let classes = [...new Set(filtered.map(item => item['CLASS']))].filter(Boolean);
      
      classSel.innerHTML = '<option value="">Select Class</option>';
      classSel.innerHTML += '<option value="ALL">ALL CLASSES (Batch Download)</option>';
      classes.forEach(c => addOption(classSel, c));
      classSel.disabled = false;
    }
    debouncedPopulateSubjects();
  } 
  else if (level === 'stream') {
    resetSelect(classSel, 'Select Class');
    document.getElementById('tableContainer').style.display = 'none';
    let selectedAdminStream = isUserAdmin ? streamSel.value : loggedInStream;
    if (!selectedAdminStream) return;
    
    let filtered = allData;
    if(year !== "ALL") filtered = filtered.filter(item => item['AC YEAR'] == year);
    if(selectedAdminStream !== "ALL") filtered = filtered.filter(item => String(item['STREAM']).toLowerCase() === selectedAdminStream.toLowerCase());
    
    let classes = [...new Set(filtered.map(item => item['CLASS']))].filter(Boolean);
    classSel.innerHTML = '<option value="">Select Class</option>';
    classSel.innerHTML += '<option value="ALL">ALL CLASSES (Batch Download)</option>';
    classes.forEach(c => addOption(classSel, c));
    classSel.disabled = false;
    debouncedPopulateSubjects();
  }
  else if (level === 'class') {
    debouncedPopulateSubjects();
    showSyllabus();
  }
}

function checkValue(val) {
  let cleanVal = val !== undefined && val !== null ? val.toString().trim() : "";
  if (cleanVal === "") {
    return `<span class="empty-cell">Pending Update</span>`;
  }
  if (cleanVal === "-") {
    return `<span class="fw-bold text-secondary text-center d-block w-100">-</span>`;
  }
  return cleanVal.replace(/\n/g, "<br>");
}

function showSyllabus() {
  let year = document.getElementById('yearSelect').value;
  let currentActiveStream = isUserAdmin ? document.getElementById('adminStreamSelect').value : loggedInStream;
  let className = document.getElementById('classSelect').value;
  let subNameFilter = isUserAdmin ? document.getElementById('adminSubNameSelect').value : "ALL";
  let tbody = document.getElementById('syllabusTableBody');
  let container = document.getElementById('tableContainer');

  tbody.innerHTML = '';
  if (!className || !year || (!isUserAdmin && !currentActiveStream)) { container.style.display = 'none'; return; }

  let filteredData = allData.filter(item => {
    let match = true;
    if(year !== "ALL") match = match && (item['AC YEAR'] == year);
    if(currentActiveStream !== "ALL" && currentActiveStream !== "") match = match && (String(item['STREAM']).toLowerCase() === currentActiveStream.toLowerCase());
    if(subNameFilter !== "ALL") match = match && (item['SUBJECTS'] === subNameFilter);
    return match;
  });

  let renderRows = [];
  let activeYears = [...new Set(filteredData.map(item => item['AC YEAR']))].filter(Boolean).sort((a, b) => {
    return a.toString().localeCompare(b.toString());
  });

  if (className === "ALL") {
    activeYears.forEach(curYear => {
      let yearFiltered = filteredData.filter(item => item['AC YEAR'] == curYear);
      let classes = [...new Set(yearFiltered.map(item => item['CLASS']))].filter(Boolean).sort();
      classes.forEach(cls => {
        let classRows = yearFiltered.filter(item => item['CLASS'] == cls);
        renderRows.push({ isHeader: true, className: cls, yearLabel: curYear });
        classRows.forEach((item, idx) => renderRows.push({ isHeader: false, data: item, localIndex: idx + 1 }));
      });
    });
  } else {
    if (year === "ALL") {
      activeYears.forEach(curYear => {
        let classRows = filteredData.filter(item => item['CLASS'] == className && item['AC YEAR'] == curYear);
        if(classRows.length > 0) {
          renderRows.push({ isHeader: true, className: className, yearLabel: curYear });
          classRows.forEach((item, idx) => renderRows.push({ isHeader: false, data: item, localIndex: idx + 1 }));
        }
      });
    } else {
      let results = filteredData.filter(item => item['CLASS'] == className);
      results.forEach((item, idx) => renderRows.push({ isHeader: false, data: item, localIndex: idx + 1 }));
    }
  }

  if(renderRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">No Data Found</td></tr>`;
    container.style.display = 'block';
    return;
  }

  let htmlAccumulator = '';
  let slNoGroupCounter = 1;

  for (let i = 0; i < renderRows.length; i++) {
    let current = renderRows[i];
    if (current.isHeader) {
      let headerText = `📁 السنة الدراسية: ${current.yearLabel} | الصف / الدفعة (CLASS): ${current.className}`;
      htmlAccumulator += `<tr class="class-group-header-web"><td colspan="10" class="class-group-header">${headerText}</td></tr>`;
      slNoGroupCounter = 1;
      continue;
    }

    let item = current.data;
    let actionCellContents = isUserAdmin
      ? `<button class="btn btn-sm btn-capsule-edit fw-bold" id="editBtn_${item.ROW_INDEX}" onclick="toggleEditRow(${item.ROW_INDEX})">Edit</button>`
      : `<span class="text-muted small">-</span>`;

    let subjectSpanCount = 1;
    let cleanCurrentSubject = item['SUBJECTS'] ? item['SUBJECTS'].toString().trim() : "";

    if (cleanCurrentSubject !== "" && cleanCurrentSubject !== "-" && cleanCurrentSubject !== "Pending Update") {
      for (let next = i + 1; next < renderRows.length; next++) {
        if (renderRows[next].isHeader) break;
        let cleanNextSubject = renderRows[next].data['SUBJECTS'] ? renderRows[next].data['SUBJECTS'].toString().trim() : "";
        if (cleanNextSubject === cleanCurrentSubject) { subjectSpanCount++; } else { break; }
      }
    }

    let isFirstSubjectInstance = (
      i === 0 || renderRows[i-1].isHeader ||
      (renderRows[i-1].data['SUBJECTS'] ? renderRows[i-1].data['SUBJECTS'].toString().trim() : "") !== cleanCurrentSubject ||
      cleanCurrentSubject === "" || cleanCurrentSubject === "-" || cleanCurrentSubject === "Pending Update"
    );
    let zebraClass = (slNoGroupCounter % 2 === 0) ? "row-even" : "row-odd";

    let slNoCell = '';
    if (isFirstSubjectInstance) {
      slNoCell = `<td class="text-center fw-bold ${zebraClass}" style="color:#64748b;vertical-align:middle;" id="slno_cell_${item.ROW_INDEX}" rowspan="${subjectSpanCount}">${slNoGroupCounter++}</td>`;
    } else if (cleanCurrentSubject === "" || cleanCurrentSubject === "-" || cleanCurrentSubject === "Pending Update") {
      slNoCell = `<td class="text-center fw-bold ${zebraClass}" style="color:#64748b;vertical-align:middle;" id="slno_cell_${item.ROW_INDEX}">${slNoGroupCounter++}</td>`;
    }

    let codeCell = '', deptCell = '', subCell = '';
    if (isFirstSubjectInstance) {
      codeCell = `<td class="text-center fw-bold ${zebraClass}" style="color:#4a5568;vertical-align:middle;" rowspan="${subjectSpanCount}" data-field="SUBJECT CODE">${checkValue(item['SUBJECT CODE'])}</td>`;
      deptCell = `<td class="text-end ${zebraClass}" style="vertical-align:middle;" rowspan="${subjectSpanCount}" data-field="DEPARTMENT">${checkValue(item['DEPARTMENT'])}</td>`;
      subCell  = `<td class="rtl-text text-center fw-bold fs-5 ${zebraClass}" style="vertical-align:middle;text-align:center !important;font-family:'Amiri',serif !important;" rowspan="${subjectSpanCount}" data-field="SUBJECTS">${checkValue(item['SUBJECTS'])}</td>`;
    } else if (cleanCurrentSubject === "" || cleanCurrentSubject === "-") {
      codeCell = `<td class="text-center fw-bold ${zebraClass}" style="color:#4a5568;vertical-align:middle;" data-field="SUBJECT CODE">${checkValue(item['SUBJECT CODE'])}</td>`;
      deptCell = `<td class="text-end ${zebraClass}" style="vertical-align:middle;" data-field="DEPARTMENT">${checkValue(item['DEPARTMENT'])}</td>`;
      subCell  = `<td class="rtl-text text-center fw-bold fs-5 ${zebraClass}" style="vertical-align:middle;text-align:center !important;font-family:'Amiri',serif !important;" data-field="SUBJECTS">${checkValue(item['SUBJECTS'])}</td>`;
    }

    htmlAccumulator += `
      <tr id="row_${item.ROW_INDEX}">
        ${slNoCell}${codeCell}${deptCell}${subCell}
        <td class="rtl-text ${zebraClass}" style="vertical-align:middle;" data-field="BOOKS">${checkValue(item['BOOKS'])}</td>
        <td class="text-center ${zebraClass}" style="vertical-align:middle;" data-field="CREDIT_S1">${checkValue(item['CREDIT_S1'])}</td>
        <td class="rtl-text ${zebraClass}" style="vertical-align:middle;text-align:right !important;" data-field="SEM 1 PORTION">${checkValue(item['SEM 1 PORTION'])}</td>
        <td class="text-center ${zebraClass}" style="vertical-align:middle;" data-field="CREDIT_S2">${checkValue(item['CREDIT_S2'])}</td>
        <td class="rtl-text ${zebraClass}" style="vertical-align:middle;text-align:right !important;" data-field="SEM 2 PORTION">${checkValue(item['SEM 2 PORTION'])}</td>
        <td class="no-print text-center ${zebraClass}" id="action_cell_${item.ROW_INDEX}">${actionCellContents}</td>
      </tr>`;

    if (subjectSpanCount > 1 && isFirstSubjectInstance) {
      let skipCount = subjectSpanCount - 1;
      for (let s = 1; s <= skipCount; s++) {
        let nextItem = renderRows[i + s].data;
        let nextActionCellContents = isUserAdmin
          ? `<button class="btn btn-sm btn-capsule-edit fw-bold" id="editBtn_${nextItem.ROW_INDEX}" onclick="toggleEditRow(${nextItem.ROW_INDEX})">Edit</button>`
          : `<span class="text-muted small">-</span>`;
        htmlAccumulator += `
          <tr id="row_${nextItem.ROW_INDEX}">
            <td class="rtl-text ${zebraClass}" style="vertical-align:middle;" data-field="BOOKS">${checkValue(nextItem['BOOKS'])}</td>
            <td class="text-center ${zebraClass}" style="vertical-align:middle;" data-field="CREDIT_S1">${checkValue(nextItem['CREDIT_S1'])}</td>
            <td class="rtl-text ${zebraClass}" style="vertical-align:middle;text-align:right !important;" data-field="SEM 1 PORTION">${checkValue(nextItem['SEM 1 PORTION'])}</td>
            <td class="text-center ${zebraClass}" style="vertical-align:middle;" data-field="CREDIT_S2">${checkValue(nextItem['CREDIT_S2'])}</td>
            <td class="rtl-text ${zebraClass}" style="vertical-align:middle;text-align:right !important;" data-field="SEM 2 PORTION">${checkValue(nextItem['SEM 2 PORTION'])}</td>
            <td class="no-print text-center ${zebraClass}" id="action_cell_${nextItem.ROW_INDEX}">${nextActionCellContents}</td>
          </tr>`;
      }
      i += skipCount;
    }
  }

  tbody.innerHTML = htmlAccumulator;
  container.style.display = 'block';

  if (typeof window._dbLoadCallback === 'function') window._dbLoadCallback();
}

function toggleEditRow(rowIndex) {
  let row = document.getElementById('row_' + rowIndex);
  let cells = row.querySelectorAll('td[data-field]');
  let actionCell = document.getElementById('action_cell_' + rowIndex);
  let actionBtn = document.getElementById('editBtn_' + rowIndex);
  
  if (actionBtn && actionBtn.innerText === "Edit") {
    activeBackupRows[rowIndex] = {};
    
    cells.forEach(cell => {
      let fieldName = cell.getAttribute('data-field');
      activeBackupRows[rowIndex][fieldName] = cell.innerHTML; 
      
      let currentText = cell.innerHTML.includes("Pending Update") ? "" : cell.innerText.trim();
      if (currentText === "-") currentText = "-";
      cell.innerHTML = `<textarea class="edit-input" data-col="${fieldName}">${currentText}</textarea>`;
    });
    
    actionCell.innerHTML = `
      <div class="d-flex gap-1 justify-content-center no-print">
        <button class="btn btn-sm btn-success fw-bold px-2 rounded-5" onclick="saveRowEdits(${rowIndex})">Save</button>
        <button class="btn btn-sm btn-secondary fw-bold px-2 rounded-5" onclick="cancelSingleRowEdits(${rowIndex})">Cancel</button>
      </div>
    `;
  }
}

function cancelSingleRowEdits(rowIndex) {
  let row = document.getElementById('row_' + rowIndex);
  let actionCell = document.getElementById('action_cell_' + rowIndex);
  
  if (activeBackupRows[rowIndex]) {
    let fields = Object.keys(activeBackupRows[rowIndex]);
    fields.forEach(field => {
      let cell = row.querySelector('td[data-field="' + field + '"]');
      if (cell) {
        cell.innerHTML = activeBackupRows[rowIndex][field]; 
      }
    });
    delete activeBackupRows[rowIndex]; 
  }
  
  actionCell.innerHTML = `<button class="btn btn-sm btn-capsule-edit fw-bold" id="editBtn_${rowIndex}" onclick="toggleEditRow(${rowIndex})">Edit</button>`;
}

function saveRowEdits(rowIndex) {
  let row = document.getElementById('row_' + rowIndex);
  let textAreas = row.querySelectorAll('textarea[data-col]');
  let pendingUpdates = textAreas.length;
  let actionCell = document.getElementById('action_cell_' + rowIndex);

  if (pendingUpdates === 0) return;
  actionCell.innerHTML = `<span class="spinner-border spinner-border-sm text-primary"></span>`;

  let updates = [];
  textAreas.forEach(ta => updates.push({ field: ta.getAttribute('data-col'), value: ta.value.trim() }));

  let lastMessage = '';
  updates.forEach(update => {
    callSyllabusGAS("updateCellData", { rowIndex: rowIndex, columnName: update.field, newValue: update.value }, function(responseMessage) {
      lastMessage = responseMessage;
      pendingUpdates--;
      if (pendingUpdates === 0) {
        showFloatingToast(
          lastMessage === "Unmerged & Updated Group"
            ? "🔄 Group merge synced & record updated inside Spreadsheet successfully!"
            : "✅ Record saved successfully!"
        );

        let rowObj = allData.find(r => r.ROW_INDEX == rowIndex);
        if (rowObj) {
          updates.forEach(u => { rowObj[u.field] = u.value; });
        }
        debouncedPopulateSubjects();
        showSyllabus();
      }
    });
  });
}

function showFloatingToast(msg) {
  let toast = document.getElementById('statusAlert');
  toast.innerText = msg;
  toast.style.display = 'block';
  setTimeout(function() {
    toast.style.display = 'none';
  }, 4500);
}

function exportToCSV() {
  let csv = [];
  let rows = document.querySelectorAll("table tr");
  for (let i = 0; i < rows.length; i++) {
    let row = [], cols = rows[i].querySelectorAll("td, th");
    for (let j = 0; j < cols.length - 1; j++) {
      let text = cols[j].innerText.replace(/"/g, '""');
      row.push('"' + text + '"');
    }
    if(row.length > 0) csv.push(row.join(","));
  }
  let csvFile = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv.join("\n")], {type: "text/csv;charset=utf-8;"});
  let downloadLink = document.createElement("a");
  downloadLink.download = "Syllabus_Ledger_Export.csv";
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink); downloadLink.click();
}

function resetSelect(select, text) {
  select.innerHTML = `<option value="">${text}</option>`;
  select.disabled = true;
}

function addOption(select, value) {
  let opt = document.createElement('option');
  opt.value = value; opt.textContent = value; select.appendChild(opt);
}

document.dir = "ltr"; 

function printSyllabus() {
  let year = document.getElementById('yearSelect').value;
  let currentActiveStream = isUserAdmin ? document.getElementById('adminStreamSelect').value : loggedInStream;
  let className = document.getElementById('classSelect').value;
  
  let arabicYear = year === "ALL" ? "سجلات التاريخ الكامل" : year;
  let arabicStream = currentActiveStream === "ALL" ? "جميع الأقسام" : (currentActiveStream.toUpperCase() === "SHE" ? "قسم الدراسات العليا العليا" : "قسم الشريعة الإسلامية");
  let arabicClass = className === "ALL" ? "جميع الصفوف Combined" : className;

  document.getElementById('pdfYear').innerText = arabicYear;
  document.getElementById('pdfStream').innerText = arabicStream;
  document.getElementById('pdfClass').innerText = arabicClass;
  
  window.print();
}
