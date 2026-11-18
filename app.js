(() => {
'use strict';
const CFG = window.DASHBOARD_CONFIG || {};
const CLOUD = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
const STORE = 'donvi_dashboard_demo_v1';
const VIEW_NAMES = {dashboard:'Tổng quan',campaigns:'Yêu cầu / Khảo sát',reports:'Nhập kết quả',departments:'Phòng ban',accounts:'Tài khoản'};
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const el = (id) => document.getElementById(id);
const e = (v) => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits = v => Number(v||0).toLocaleString('vi-VN');
const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const localDay = (delta=0) => {const d=new Date();d.setDate(d.getDate()+delta);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const prettyDay = val => {if(!val)return 'Không hạn';const [y,m,d] = String(val).split('-');return `${d}/${m}/${y}`};
const niceTime = val => val ? new Date(val).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const norm = v => String(v||'').toLocaleLowerCase('vi-VN');
const short = (v,n=70) => {const s=String(v||'');return s.length>n?s.slice(0,n).trim()+'…':s};
const validURL = v => {try {const url = new URL(v);return ['https:','http:'].includes(url.protocol) ? url.href : ''}catch{return ''}};
const icons = {dashboard:'◫',campaigns:'▤',reports:'✎',departments:'▦',accounts:'♙'};
let supa = null;
let toastTimer;
const state = {
  view:'dashboard',modal:null,menu:false,authMode:'login',loading:false,
  filter:{search:'',type:'all',department:'all',status:'all'},
  demoRole: localStorage.getItem('donvi_demo_role') || 'admin',
  demoDept: localStorage.getItem('donvi_demo_dept') || 'dep_hc',
  user:null, profile:null, db:null
};

function demoSeed(){
 const deps=[
  {id:'dep_hc',name:'Hành chính – Tổng hợp'}, {id:'dep_tc',name:'Tài chính – Kế toán'},
  {id:'dep_ns',name:'Tổ chức – Nhân sự'}, {id:'dep_cntt',name:'Công nghệ thông tin'},
  {id:'dep_kh',name:'Kế hoạch – Nghiệp vụ'}, {id:'dep_kt',name:'Kiểm tra – Giám sát'}
 ];
 const campaigns=[
  {id:'cam_1',title:'Báo cáo tiến độ công tác tháng 11',type:'task',description:'Tổng hợp nhiệm vụ trọng tâm đã triển khai, kết quả đạt được và những công việc còn tồn đọng trong tháng.',due_date:localDay(5),status:'active',questions:[],created_at:new Date().toISOString()},
  {id:'cam_2',title:'Khảo sát mức độ chuyển đổi số',type:'survey',description:'Thu thập số liệu và đánh giá việc ứng dụng công nghệ thông tin tại các phòng.',due_date:localDay(9),status:'active',questions:[{label:'Số quy trình đã số hóa',type:'number'},{label:'Phòng đã áp dụng chữ ký số?',type:'yesno'},{label:'Khó khăn, kiến nghị',type:'text'}],created_at:new Date(Date.now()-86400000).toISOString()},
  {id:'cam_3',title:'Rà soát nhiệm vụ cuối năm',type:'task',description:'Đánh giá việc thực hiện nhiệm vụ và đề xuất phương án hoàn thành các chỉ tiêu cuối năm.',due_date:localDay(-2),status:'active',questions:[],created_at:new Date(Date.now()-2*86400000).toISOString()},
  {id:'cam_4',title:'Khảo sát nhu cầu trang thiết bị',type:'survey',description:'Lập dự kiến nhu cầu trang thiết bị phục vụ công việc năm sau.',due_date:localDay(16),status:'active',questions:[{label:'Số thiết bị đề xuất bổ sung',type:'number'},{label:'Danh sách thiết bị ưu tiên',type:'text'}],created_at:new Date(Date.now()-3*86400000).toISOString()},
  {id:'cam_5',title:'Báo cáo tình hình xử lý kiến nghị',type:'task',description:'Tổng hợp tình hình xử lý các kiến nghị, vướng mắc từ đầu quý đến nay.',due_date:localDay(2),status:'active',questions:[],created_at:new Date(Date.now()-86400000).toISOString()}
 ];
 const assignments=[]; const submissions=[];
 campaigns.forEach((c,ci)=>deps.forEach((d,di)=>{
  const a={id:`as_${ci}_${di}`,campaign_id:c.id,department_id:d.id};assignments.push(a);
  const sample=(ci*4+di*3)%8;
  if(sample<=3){
   const survey=c.type==='survey';
   const pr=survey?100:[100,70,40,100][sample];
   const surveyAnswers={};
   (c.questions||[]).forEach((q,qi)=>surveyAnswers[String(qi)]=q.type==='number' ? String((di+1)*5) : q.type==='yesno'?'Có':'Đơn vị đang triển khai, cần tăng cường hỗ trợ.');
   submissions.push({id:`sub_${ci}_${di}`,assignment_id:a.id,user_id:'demo',progress:pr,status:pr===100?'completed':'in_progress',summary:survey?'Đã hoàn thành khảo sát.':(pr===100?'Đã hoàn thành các đầu việc được giao.':'Đang triển khai theo kế hoạch, còn một số nội dung cần hoàn thiện.'),answers:surveyAnswers,evidence_url:'',updated_at:new Date(Date.now()-(sample+1)*7200000).toISOString()});
  }
 }));
 return {departments:deps,campaigns,assignments,submissions,profiles:[]};
}
function loadDemo(){
 try {const s=localStorage.getItem(STORE); if(s){const v=JSON.parse(s);if(v && Array.isArray(v.campaigns) && Array.isArray(v.assignments))return v}}catch{}
 const d=demoSeed();saveDemo(d);return d;
}
function saveDemo(db=state.db){localStorage.setItem(STORE,JSON.stringify(db))}
function toast(msg,error=false){const t=el('toast');t.textContent=msg;t.className=`toast show${error?' error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='toast',3500)}
function admin(){return CLOUD ? state.profile?.role==='admin' : state.demoRole==='admin'}
function currentDep(){return CLOUD?state.profile?.department_id:state.demoDept}
function deptName(id){return state.db?.departments.find(x=>x.id===id)?.name||'Chưa có phòng'}
function subOf(assId){return state.db.submissions.find(s=>s.assignment_id===assId)}
function assignmentsFor(cId){return state.db.assignments.filter(a=>a.campaign_id===cId)}
function scopeAssignments(){return admin()?state.db.assignments:state.db.assignments.filter(a=>a.department_id===currentDep())}
function scopeCampaigns(){const ids=new Set(scopeAssignments().map(a=>a.campaign_id));return state.db.campaigns.filter(c=>ids.has(c.id))}
function getCampaign(id){return state.db.campaigns.find(c=>c.id===id)}
function progress(a){const sub=subOf(a.id);return sub?Math.min(100,Math.max(0,Number(sub.progress)||0)):0}
function isOverdue(a){const c=getCampaign(a.campaign_id);return c&&c.status==='active'&&c.due_date<localDay()&&progress(a)<100}
function assignmentStatus(a){const sub=subOf(a.id);if(progress(a)===100)return 'done';if(isOverdue(a))return 'overdue';if(sub&&progress(a)>0)return 'inprogress';return 'pending'}
function statusText(s){return {done:'Hoàn thành',overdue:'Quá hạn',inprogress:'Đang thực hiện',pending:'Chưa báo cáo'}[s]||'Chưa rõ'}
function statusTag(s){return `<span class="status ${s}">● ${statusText(s)}</span>`}
function stats(list=scopeAssignments()){
 const total=list.length, done=list.filter(a=>progress(a)===100).length, overdue=list.filter(isOverdue).length,
 reported=list.filter(a=>!!subOf(a.id)).length, inprogress=list.filter(a=>assignmentStatus(a)==='inprogress').length;
 return {total,done,overdue,reported,inprogress,pending:total-done-inprogress-overdue,percent:total?Math.round(done/total*100):0};
}
function campaignStats(c){return stats(scopeAssignments().filter(a=>a.campaign_id===c.id))}
function render(){
 const root=el('app');
 if(CLOUD&&!state.user){root.innerHTML=renderAuth();return}
 if(CLOUD&&!state.profile){root.innerHTML=`<div class="startup">Không đọc được hồ sơ tài khoản. Vui lòng tải lại trang hoặc liên hệ quản trị.</div>`;return}
 const page=state.view;
 const pageHTML={dashboard:renderDashboard,campaigns:renderCampaigns,reports:renderReports,departments:renderDepartments,accounts:renderAccounts}[page]();
 root.innerHTML=`<div class="layout"><aside class="sidebar ${state.menu?'open':''}" id="sidebar">
    <div class="brand"><div class="brand-symbol">▥</div><div><b>ĐIỀU HÀNH 360</b><small>Báo cáo & khảo sát nội bộ</small></div></div>
    <div class="nav-caption">QUẢN LÝ</div>
    ${Object.entries(VIEW_NAMES).filter(([key])=>key!=='accounts'||admin()).map(([key,label])=>`<button class="nav-item ${key===page?'active':''}" data-action="navigate" data-view="${key}"><span class="ico">${icons[key]}</span>${label}</button>`).join('')}
    <div class="side-bottom"><div class="side-info"><div class="tiny">ĐƠN VỊ</div><b>${e(CFG.ORGANIZATION_NAME||'Đơn vị của tôi')}</b><div class="tiny">${CLOUD?'☁ Dữ liệu đồng bộ trực tuyến':'◉ Phiên bản dùng thử (lưu tại máy)'}</div>
    ${CLOUD?`<button data-action="change-password">Đặt / Đổi mật khẩu</button><button data-action="logout">Đăng xuất ↗</button>`:`<button data-action="reset-demo">Khôi phục dữ liệu mẫu ↺</button>`}</div></div>
  </aside><div class="main"><header class="topbar"><div style="display:flex;align-items:center;gap:12px"><button class="mobile-menu" data-action="menu">☰</button><div><div class="breadcrumb">Không gian làm việc / ${e(VIEW_NAMES[page])}</div><h1 class="page-title">${e(VIEW_NAMES[page])}</h1></div></div>
    <div class="top-right">${CLOUD?'':`<select class="demo-switch" id="demo-switch" aria-label="Chuyển vai trò dùng thử"><option value="admin" ${admin()?'selected':''}>👤 Quản trị viên</option>${state.db.departments.map(d=>`<option value="${e(d.id)}" ${!admin()&&currentDep()===d.id?'selected':''}>🏢 ${e(d.name)}</option>`).join('')}</select>`}<div class="mode-label">${CLOUD?'TRỰC TUYẾN':'DÙNG THỬ'}</div><div class="avatar">${admin()?'QT':'CB'}</div><div class="user-meta"><b>${e(CLOUD?state.profile.full_name:(admin()?'Quản trị viên':'Cán bộ phòng'))}</b>${e(admin()?'Người quản lý':deptName(currentDep()))}</div></div>
  </header><main class="content"><div class="view">${pageHTML}</div></main></div></div>${state.modal?renderModal():''}`;
}
function hero(title,desc,actions=''){return `<div class="hero"><div><h2>${title}</h2><p>${desc}</p></div>${actions?`<div class="hero-actions">${actions}</div>`:''}</div>`}
function exportBtn(){return `<button class="btn" data-action="export">⇩ Xuất báo cáo CSV</button>`}
function createBtn(){return `<button class="btn btn-primary" data-action="new-campaign">＋ Tạo yêu cầu mới</button>`}
function renderDashboard(){
 const ss=stats(), rows=scopeAssignments(), chartDepartments=admin()?state.db.departments:state.db.departments.filter(d=>d.id===currentDep());
 const covered=chartDepartments.filter(d=>rows.some(a=>a.department_id===d.id));
 const donePct=ss.total ? (ss.done/ss.total*100) : 0;const progPct=ss.total?(ss.inprogress/ss.total*100):0;const overduePct=ss.total?(ss.overdue/ss.total*100):0;
 const dough=`conic-gradient(#1cb398 0% ${donePct}%,#6382ec ${donePct}% ${donePct+progPct}%,#e87a76 ${donePct+progPct}% ${donePct+progPct+overduePct}%,#edf0f7 ${donePct+progPct+overduePct}% 100%)`;
 const recent=rows.slice().sort((a,b)=>new Date(subOf(b.id)?.updated_at||0)-new Date(subOf(a.id)?.updated_at||0)).slice(0,7);
 return `${hero('Bảng điều hành tổng hợp',`Theo dõi tình hình thực hiện của ${admin()?'toàn đơn vị':e(deptName(currentDep()))} · Cập nhật ngày ${prettyDay(localDay())}`,`${CLOUD?'<button class="btn" data-action="refresh">↻ Làm mới</button>':''}${exportBtn()}${admin()?createBtn():''}`)}
 ${!CLOUD?`<div class="notice">✨ <b>Đang ở chế độ dùng thử.</b> Chọn vai trò ở góc phải để xem giao diện quản trị hoặc cán bộ. Dữ liệu chỉ được lưu trong trình duyệt hiện tại, chưa chia sẻ giữa các thiết bị.</div>`:(!admin()&&!currentDep()?`<div class="notice warning">Tài khoản của bạn chưa được gán phòng ban. Vui lòng liên hệ người quản trị.</div>`:'')}
 <div class="stat-grid">
  <div class="stat-card"><div class="stat-label">Tổng lượt phải báo cáo</div><div class="stat-value">${digits(ss.total)}</div><div class="stat-foot">${scopeCampaigns().length} yêu cầu / đợt khảo sát</div></div>
  <div class="stat-card teal"><div class="stat-label">Đã hoàn thành</div><div class="stat-value">${digits(ss.done)}</div><div class="stat-foot">Đạt ${ss.percent}% kế hoạch</div></div>
  <div class="stat-card amber"><div class="stat-label">Đang thực hiện</div><div class="stat-value">${digits(ss.inprogress)}</div><div class="stat-foot">${ss.reported} lượt đã có cập nhật</div></div>
  <div class="stat-card red"><div class="stat-label">Quá hạn chưa xong</div><div class="stat-value">${digits(ss.overdue)}</div><div class="stat-foot">Cần theo dõi và đôn đốc</div></div>
 </div>
 <div class="section-grid"><section class="panel"><div class="panel-header"><h3>Tình trạng thực hiện chung</h3><span class="subtle">Theo lượt phòng × yêu cầu</span></div>
  <div class="chart-head"><div class="donut" style="background:${dough}"><div class="donut-center"><strong>${ss.percent}%</strong><small>Hoàn thành</small></div></div>
  <div class="legend-list"><div class="legend-row"><span class="legend-left"><i class="dot green"></i>Hoàn thành</span><b>${ss.done}</b></div><div class="legend-row"><span class="legend-left"><i class="dot blue"></i>Đang thực hiện</span><b>${ss.inprogress}</b></div><div class="legend-row"><span class="legend-left"><i class="dot orange"></i>Chưa báo cáo</span><b>${ss.pending}</b></div><div class="legend-row"><span class="legend-left"><i class="dot red"></i>Quá hạn</span><b>${ss.overdue}</b></div></div></div></section>
  <section class="panel"><div class="panel-header"><h3>Hoàn thành theo phòng ban</h3><span class="subtle">Tỷ lệ %</span></div>
  ${covered.length?`<div class="mini-chart">${covered.map(d=>{const s=stats(rows.filter(a=>a.department_id===d.id));return `<div class="bar-column"><div class="bar-number">${s.percent}%</div><div class="bar-track"><div class="bar-fill" style="height:${Math.max(2,s.percent)}%"></div></div><div class="bar-name" title="${e(d.name)}">${e(d.name.replace(/\s*[–-]\s*/g,' ').split(' ').slice(0,2).join(' '))}</div></div>`}).join('')}</div>`:'<div class="empty">Chưa có dữ liệu</div>'}</section></div>
 <section class="panel"><div class="panel-header"><h3>Cập nhật gần đây & việc cần quan tâm</h3><button class="link-btn" data-action="navigate" data-view="reports">Xem tất cả →</button></div>
 ${recent.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>YÊU CẦU / KHẢO SÁT</th><th>PHÒNG BAN</th><th>HẠN NỘP</th><th>TIẾN ĐỘ</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody>${recent.map(a=>{const c=getCampaign(a.campaign_id);return `<tr><td class="primary-cell">${e(c?.title)}<div class="cell-detail">${c?.type==='survey'?'Khảo sát':'Công việc'}</div></td><td>${e(deptName(a.department_id))}</td><td>${prettyDay(c?.due_date)}</td><td><div class="progress"><div class="progress-fill ${progress(a)===100?'full':''}" style="width:${progress(a)}%"></div></div><div class="progress-text">${progress(a)}%</div></td><td>${statusTag(assignmentStatus(a))}</td><td><button class="link-btn" data-action="respond" data-assignment="${e(a.id)}">${admin()?'Xem':'Cập nhật'}</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">Chưa có nhiệm vụ. Hãy tạo yêu cầu đầu tiên.</div>'}</section>`;
}
function filteredCampaigns(){let list=scopeCampaigns().slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
 const f=state.filter; if(f.type!=='all')list=list.filter(c=>c.type===f.type);if(f.search)list=list.filter(c=>norm(c.title+' '+c.description).includes(norm(f.search)));
 return list;
}
function renderCampaigns(){
 const list=filteredCampaigns();
 return `${hero('Danh sách yêu cầu & khảo sát','Tạo nội dung, phân công phòng ban, theo dõi tỷ lệ phản hồi.',admin()?createBtn():'')}
 <div class="filters"><input class="search-field" id="filter-search" value="${e(state.filter.search)}" placeholder="⌕  Tìm theo tên hoặc nội dung..."/>
 <select class="field" id="filter-type"><option value="all">Tất cả loại</option><option value="task" ${state.filter.type==='task'?'selected':''}>Công việc</option><option value="survey" ${state.filter.type==='survey'?'selected':''}>Khảo sát</option></select></div>
 ${list.length?`<div class="card-list">${list.map(c=>{const s=campaignStats(c);const depCount=scopeAssignments().filter(a=>a.campaign_id===c.id).length;return `<article class="campaign-card"><div class="card-top"><span class="tag ${c.type==='survey'?'survey':''}">${c.type==='survey'?'◈ KHẢO SÁT':'◼ CÔNG VIỆC'}</span>${c.status==='closed'?'<span class="tag closed">ĐÃ ĐÓNG</span>':`<span class="subtle">Hạn ${prettyDay(c.due_date)}</span>`}</div><h3>${e(c.title)}</h3><p>${e(short(c.description,135)||'Chưa có mô tả')}</p><div class="progress"><div class="progress-fill ${s.percent===100?'full':''}" style="width:${s.percent}%"></div></div><div class="card-bottom"><span class="card-meta"><b class="count">${s.done}/${depCount}</b> phòng hoàn thành · ${s.percent}%</span><button class="btn btn-sm btn-light" data-action="detail" data-id="${e(c.id)}">Chi tiết →</button></div></article>`}).join('')}</div>`:`<div class="panel empty"><span class="empty-icon">▤</span>Chưa có nội dung phù hợp bộ lọc.</div>`}`;
}
function reportRows(){let list=scopeAssignments().slice();const f=state.filter;
 if(f.department!=='all')list=list.filter(a=>a.department_id===f.department);
 if(f.status!=='all')list=list.filter(a=>assignmentStatus(a)===f.status);
 if(f.type!=='all')list=list.filter(a=>getCampaign(a.campaign_id)?.type===f.type);
 if(f.search)list=list.filter(a=>norm(`${getCampaign(a.campaign_id)?.title} ${deptName(a.department_id)}`).includes(norm(f.search)));
 list.sort((a,b)=>{const aa=getCampaign(a.campaign_id),bb=getCampaign(b.campaign_id);return String(aa?.due_date||'').localeCompare(String(bb?.due_date||''))});return list;
}
function renderReports(){
 const list=reportRows();return `${hero(admin()?'Theo dõi kết quả báo cáo':'Cập nhật kết quả thực hiện',admin()?'Kiểm tra từng phòng đã nộp và xem kết quả chi tiết.':'Mở từng yêu cầu được giao để nhập tiến độ, số liệu hoặc trả lời khảo sát.',exportBtn())}
 <div class="filters"><input class="search-field" id="filter-search" value="${e(state.filter.search)}" placeholder="⌕  Tìm yêu cầu hoặc phòng ban..."/>
 ${admin()?`<select id="filter-department" class="field"><option value="all">Tất cả phòng</option>${state.db.departments.map(d=>`<option value="${e(d.id)}" ${state.filter.department===d.id?'selected':''}>${e(d.name)}</option>`).join('')}</select>`:''}
 <select id="filter-status" class="field"><option value="all">Mọi trạng thái</option>${['done','inprogress','pending','overdue'].map(s=>`<option value="${s}" ${fIs('status',s)}>${statusText(s)}</option>`).join('')}</select>
 <select id="filter-type" class="field"><option value="all">Mọi loại</option><option value="task" ${fIs('type','task')}>Công việc</option><option value="survey" ${fIs('type','survey')}>Khảo sát</option></select></div>
 <section class="panel" style="padding:0"><div class="table-wrap"><table class="data-table"><thead><tr><th>YÊU CẦU</th><th>PHÒNG BAN</th><th>HẠN NỘP</th><th>TRẠNG THÁI</th><th>TIẾN ĐỘ</th><th>CẬP NHẬT</th><th>THAO TÁC</th></tr></thead><tbody>${list.map(a=>{const c=getCampaign(a.campaign_id),sub=subOf(a.id);return `<tr><td class="primary-cell">${e(c?.title)}<div class="cell-detail">${c?.type==='survey'?'◈ Khảo sát':'◼ Công việc'}${c?.status==='closed'?' · Đã đóng':''}</div></td><td>${e(deptName(a.department_id))}</td><td>${prettyDay(c?.due_date)}</td><td>${statusTag(assignmentStatus(a))}</td><td><div class="progress"><div class="progress-fill ${progress(a)===100?'full':''}" style="width:${progress(a)}%"></div></div><div class="progress-text">${progress(a)}%</div></td><td><span class="subtle">${sub?niceTime(sub.updated_at):'Chưa có'}</span></td><td><button class="btn btn-sm ${admin()?'':'btn-light'}" data-action="respond" data-assignment="${e(a.id)}">${admin()?'Xem kết quả':c?.status==='closed'?'Xem':'Nhập kết quả'}</button></td></tr>`}).join('')}</tbody></table>${!list.length?'<div class="empty">Không tìm thấy kết quả phù hợp.</div>':''}</div></section>`;
}
function fIs(k,v){return state.filter[k]===v?'selected':''}
function renderDepartments(){const deps=admin()?state.db.departments:state.db.departments.filter(d=>d.id===currentDep());return `${hero('Danh mục phòng ban','Theo dõi mức độ đáp ứng của từng phòng theo tất cả yêu cầu đã giao.',admin()?`<button class="btn btn-primary" data-action="new-department">＋ Thêm phòng ban</button>`:'')}
 <div class="dept-grid">${deps.map(d=>{const s=stats(scopeAssignments().filter(a=>a.department_id===d.id));return `<div class="dept-card"><h3>▦ ${e(d.name)}</h3><div class="large">${s.percent}%</div><p>${s.done}/${s.total} lượt đã hoàn thành</p><div class="progress"><div class="progress-fill ${s.percent===100?'full':''}" style="width:${s.percent}%"></div></div><p>${s.overdue?'⚠ '+s.overdue+' lượt quá hạn':'Không có lượt quá hạn'}</p></div>`}).join('')}</div>`}
function renderAccounts(){if(!admin())return '<div class="notice warning">Bạn không có quyền quản lý tài khoản.</div>';
 if(!CLOUD)return `${hero('Tài khoản cán bộ','Phân quyền tài khoản được sử dụng khi kết nối dữ liệu trực tuyến.')}
 <div class="notice"><b>Chế độ dùng thử:</b> Bạn có thể chuyển giữa vai trò Quản trị viên và cán bộ của từng phòng ở góc phải. Khi kết nối Supabase, tài khoản đăng ký sẽ xuất hiện tại mục này để quản trị viên phân phòng.</div>`;
 return `${hero('Phân quyền cán bộ','Gán phòng ban và vai trò cho tài khoản đã đăng ký.')}<div class="notice warning">Chỉ gán vai trò <b>Quản trị viên</b> cho người được phép xem, chỉnh sửa toàn bộ dữ liệu của đơn vị.</div>
 <section class="panel" style="padding:0"><div class="table-wrap"><table class="data-table"><thead><tr><th>CÁN BỘ</th><th>TÊN ĐĂNG NHẬP</th><th>EMAIL (QUẢN TRỊ)</th><th>PHÒNG BAN</th><th>VAI TRÒ</th><th></th></tr></thead><tbody>${state.db.profiles.map(p=>`<tr><td class="primary-cell">${e(p.full_name||'Chưa đặt tên')}</td><td><input class="field" id="profile-username-${e(p.id)}" value="${e(p.username||'')}" placeholder="vd: nv001" maxlength="30" pattern="[a-zA-Z0-9]{3,30}" title="3–30 ký tự chữ hoặc số"></td><td>${e(p.email)}</td><td><select class="field" id="profile-dep-${e(p.id)}"><option value="">Chưa phân phòng</option>${state.db.departments.map(d=>`<option value="${e(d.id)}" ${p.department_id===d.id?'selected':''}>${e(d.name)}</option>`).join('')}</select></td><td><select class="field" id="profile-role-${e(p.id)}"><option value="staff" ${p.role==='staff'?'selected':''}>Cán bộ</option><option value="admin" ${p.role==='admin'?'selected':''}>Quản trị viên</option></select></td><td><button class="btn btn-sm btn-light" data-action="save-profile" data-id="${e(p.id)}">Lưu</button></td></tr>`).join('')}</tbody></table></div></section>`;
}
function renderSurveySummary(c,ass){
 const subs=ass.map(a=>({sub:subOf(a.id),department:deptName(a.department_id)})).filter(x=>x.sub&&x.sub.progress===100);
 if(!subs.length)return '<div class="notice warning">Chưa có phiếu khảo sát hoàn thành để tổng hợp số liệu.</div>';
 const blocks=(c.questions||[]).map((q,i)=>{
  const answers=subs.map(x=>({v:String(x.sub.answers?.[i]??'').trim(),department:x.department})).filter(x=>x.v!=='');
  if(q.type==='number'){
   const nums=answers.map(x=>Number(x.v)).filter(v=>Number.isFinite(v));
   const total=nums.reduce((sum,v)=>sum+v,0),avg=nums.length?total/nums.length:0;
   return `<div class="summary-box"><div class="summary-question">${e(q.label)}</div><div class="summary-number">${digits(total)}</div><div class="subtle">Tổng cộng · Bình quân ${Number(avg.toFixed(2)).toLocaleString('vi-VN')} · ${nums.length} phòng đã nhập</div></div>`;
  }
  if(q.type==='yesno'){
   const yes=answers.filter(a=>norm(a.v)==='có').length,no=answers.filter(a=>norm(a.v)==='không').length;
   return `<div class="summary-box"><div class="summary-question">${e(q.label)}</div><div class="summary-number">${yes} <span style="font-size:12px;color:#7a8ba0">Có</span></div><div class="subtle">${no} Không · ${answers.length} phòng phản hồi</div></div>`;
  }
  return `<div class="summary-box"><div class="summary-question">${e(q.label)}</div><div class="summary-number">${answers.length} <span style="font-size:12px;color:#7a8ba0">ý kiến</span></div><div class="subtle">${answers.slice(0,2).map(a=>e(short(a.department+': '+a.v,80))).join(' · ')||'Chưa có nội dung'}</div></div>`;
 });
 return `<div class="subheading">Tổng hợp số liệu khảo sát</div><div class="summary-grid">${blocks.join('')}</div><p class="form-hint">Số liệu tổng hợp từ các phiếu hoàn thành. Bạn có thể xuất CSV để xem toàn bộ câu trả lời của từng phòng.</p>`;
}
function modalShell(title,body,footer='',wide=false){return `<div class="modal-backdrop" data-action="backdrop"><div class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${e(title)}"><div class="modal-header"><h2>${e(title)}</h2><button class="close" data-action="close-modal" aria-label="Đóng">×</button></div>${body}${footer}</div></div>`}
function renderModal(){
 const m=state.modal;
 if(m.type==='password')return modalShell('Đặt / Đổi mật khẩu',`<form id="form-password"><div class="modal-body"><div class="notice">Cán bộ được mời qua email hãy đặt mật khẩu riêng trước khi đăng xuất. Không chia sẻ mật khẩu với người khác.</div><div class="form-group"><label>Mật khẩu mới *</label><input class="field" name="new_password" type="password" autocomplete="new-password" minlength="8" required placeholder="Ít nhất 8 ký tự"></div><div class="form-group"><label>Nhập lại mật khẩu mới *</label><input class="field" name="confirm_password" type="password" autocomplete="new-password" minlength="8" required></div></div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Hủy</button><button class="btn btn-primary" type="submit">Lưu mật khẩu</button></div></form>`);
 if(m.type==='new-department')return modalShell('Thêm phòng ban',`<form id="form-department"><div class="modal-body"><div class="form-group"><label for="dept-name">Tên phòng ban *</label><input class="field" id="dept-name" name="name" required maxlength="120" autofocus placeholder="Ví dụ: Phòng Hành chính – Tổng hợp" /></div></div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Hủy</button><button type="submit" class="btn btn-primary">Lưu phòng ban</button></div></form>`);
 if(m.type==='new-campaign')return modalShell('Tạo yêu cầu / đợt khảo sát',`<form id="form-campaign"><div class="modal-body">
 <div class="form-grid"><div class="form-group"><label for="campaign-type">Loại yêu cầu *</label><select id="campaign-type" name="type" class="field"><option value="task">Công việc / Báo cáo</option><option value="survey">Khảo sát số liệu</option></select></div><div class="form-group"><label for="campaign-due">Hạn chót *</label><input id="campaign-due" class="field" name="due" type="date" required value="${localDay(7)}" /></div></div>
 <div class="form-group"><label for="campaign-title">Tên yêu cầu *</label><input id="campaign-title" class="field" name="title" maxlength="180" required placeholder="Ví dụ: Báo cáo kết quả tháng 11/2026" /></div>
 <div class="form-group"><label for="campaign-desc">Nội dung, hướng dẫn thực hiện</label><textarea id="campaign-desc" class="field" name="description" maxlength="5000" placeholder="Mô tả kết quả cần báo cáo, biểu mẫu, lưu ý..." ></textarea></div>
 <div class="form-group"><label>Giao cho phòng ban *</label><div class="check-grid">${state.db.departments.map(d=>`<label class="check-item"><input type="checkbox" name="departments" value="${e(d.id)}" checked />${e(d.name)}</label>`).join('')}</div><span class="form-hint">Chỉ các phòng được chọn mới thấy yêu cầu này khi đăng nhập.</span></div>
 <div class="question-box hidden" id="question-box"><div class="form-group"><label>Câu hỏi khảo sát (mỗi dòng một câu)</label><textarea id="campaign-questions" class="field" placeholder="[số] Số lượt đã xử lý\n[có/không] Đã hoàn thành chuyển đổi số?\n[văn bản] Những khó khăn, kiến nghị"></textarea><span class="form-hint">Mặc định là câu trả lời văn bản. Dùng <b>[số]</b> cho ô số hoặc <b>[có/không]</b> cho lựa chọn Có / Không.</span></div></div>
 </div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Hủy</button><button type="submit" class="btn btn-primary">Tạo và giao việc</button></div></form>`);
 if(m.type==='detail'){
  const c=getCampaign(m.id);if(!c)return '';
  const ass=scopeAssignments().filter(a=>a.campaign_id===c.id);const s=campaignStats(c);
  return modalShell(c.title,`<div class="modal-body"><div class="report-meta"><span class="tag ${c.type==='survey'?'survey':''}">${c.type==='survey'?'KHẢO SÁT':'CÔNG VIỆC'}</span><span>Hạn ${prettyDay(c.due_date)}</span><span>·</span><span>${c.status==='active'?'Đang mở':'Đã đóng'}</span></div>
  <p style="font-size:12px;line-height:1.9;color:#66758c;margin:15px 0">${e(c.description||'Không có mô tả bổ sung.')}</p><div class="notice">Đã hoàn thành <b>${s.done}/${ass.length}</b> phòng · Tỷ lệ <b>${s.percent}%</b></div>${c.type==='survey'?renderSurveySummary(c,ass):''}<div class="subheading">Kết quả theo phòng ban</div>
  ${ass.map(a=>{const sub=subOf(a.id);return `<div class="row-report"><div style="min-width:0"><div class="report-name">${e(deptName(a.department_id))}</div><div class="report-summary">${e(sub?.summary||'Chưa có nội dung phản hồi')}</div><div style="margin-top:6px">${statusTag(assignmentStatus(a))}</div></div><button class="btn btn-sm btn-light" data-action="respond" data-assignment="${e(a.id)}">${admin()?'Xem':'Cập nhật'}</button></div>`}).join('')}${ass.length?'':'<div class="empty">Không có phòng được giao.</div>'}</div>
  <div class="modal-footer"><button class="btn" data-action="export-campaign" data-id="${e(c.id)}">⇩ Xuất CSV đợt này</button>${admin()?`<button class="btn ${c.status==='active'?'btn-danger':'btn-light'}" data-action="toggle-campaign" data-id="${e(c.id)}">${c.status==='active'?'Đóng yêu cầu':'Mở lại yêu cầu'}</button>`:''}<button class="btn" data-action="close-modal">Đóng</button></div>`,true);
 }
 if(m.type==='respond'){
  const a=state.db.assignments.find(x=>x.id===m.assignmentId);const c=a&&getCampaign(a.campaign_id);if(!a||!c)return '';
  const sub=subOf(a.id);const readonly=admin()||c.status==='closed';const p=progress(a);
  let body=`<div class="modal-body"><div class="report-meta"><span class="tag ${c.type==='survey'?'survey':''}">${c.type==='survey'?'KHẢO SÁT':'CÔNG VIỆC'}</span><span>${e(deptName(a.department_id))}</span><span>·</span><span>Hạn ${prettyDay(c.due_date)}</span></div><p style="color:#66758c;font-size:12px;line-height:1.8">${e(c.description||'')}</p>`;
  if(readonly){
    body+=`<div class="notice ${!sub?'warning':''}">${sub?`Cập nhật gần nhất: ${niceTime(sub.updated_at)} · Tiến độ: <b>${p}%</b>`:'Phòng ban này chưa gửi kết quả.'}</div>`;
    if(sub){
      if(c.type==='survey')body+=(c.questions||[]).map((q,i)=>`<div class="survey-row"><label>${e(q.label)}</label><div>${e(sub.answers?.[i]??'—')}</div></div>`).join('');
      body+=`<div class="subheading">Tóm tắt kết quả</div><p style="white-space:pre-wrap">${e(sub.summary||'—')}</p>`;
      if(sub.evidence_url && validURL(sub.evidence_url))body+=`<p><a href="${e(validURL(sub.evidence_url))}" target="_blank" rel="noopener noreferrer">Mở tài liệu minh chứng ↗</a></p>`;
    }
    return modalShell(c.title,body+'</div>',`<div class="modal-footer"><button class="btn" data-action="detail" data-id="${e(c.id)}">Quay lại</button><button class="btn btn-primary" data-action="close-modal">Đóng</button></div>`);
  }
  body=`<form id="form-response" data-assignment="${e(a.id)}">`+body;
  if(c.type==='survey'){
   body+=`<div class="subheading">Nội dung khảo sát</div>`;
   (c.questions||[]).forEach((q,i)=>{
    let input='';const val=sub?.answers?.[i] ?? '';
    if(q.type==='number')input=`<input class="field" type="number" step="any" name="q_${i}" value="${e(val)}" required placeholder="Nhập số liệu...">`;
    else if(q.type==='yesno')input=`<select name="q_${i}" class="field" required><option value="">Chọn câu trả lời</option><option value="Có" ${val==='Có'?'selected':''}>Có</option><option value="Không" ${val==='Không'?'selected':''}>Không</option></select>`;
    else input=`<textarea name="q_${i}" class="field" required placeholder="Nhập kết quả...">${e(val)}</textarea>`;
    body+=`<div class="survey-row"><label>${i+1}. ${e(q.label)} *</label>${input}</div>`;
   });
  }else{
   body+=`<div class="subheading">Mức độ hoàn thành: <span id="range-value">${p}%</span></div><div class="form-group"><input type="range" min="0" max="100" step="5" value="${p}" name="progress" id="range-progress" aria-label="Tiến độ hoàn thành" style="width:100%;accent-color:#365cdd"></div>`;
  }
  body+=`<div class="form-group"><label for="response-summary">${c.type==='survey'?'Nhận xét / Ghi chú bổ sung':'Kết quả thực hiện, khó khăn và kiến nghị'} ${c.type==='task'?'*':''}</label><textarea id="response-summary" name="summary" class="field" ${c.type==='task'?'required':''} placeholder="Nêu ngắn gọn kết quả và các vấn đề cần hỗ trợ...">${e(sub?.summary||'')}</textarea></div>
  <div class="form-group"><label for="response-evidence">Đường dẫn tài liệu minh chứng (tùy chọn)</label><input id="response-evidence" class="field" name="evidence" type="url" placeholder="https://drive.google.com/..." value="${e(sub?.evidence_url||'')}"/><span class="form-hint">Dán liên kết tài liệu có quyền truy cập phù hợp; ứng dụng mẫu chưa hỗ trợ tải tệp lên trực tiếp.</span></div></div>
  <div class="modal-footer"><button class="btn" type="button" data-action="detail" data-id="${e(c.id)}">Quay lại</button><button class="btn btn-primary" type="submit">✓ Lưu kết quả</button></div></form>`;
  return modalShell(c.title,body);
 }
 return '';
}
function renderAuth(){return `<div class="auth-layout"><div class="auth-banner"><div class="eyebrow">▥ ${e(CFG.ORGANIZATION_NAME || 'Dashboard đơn vị')}</div><h1>Quản lý công việc và khảo sát nội bộ trên một nền tảng.</h1><p>Giao việc cho từng phòng, thu thập báo cáo từ cán bộ, theo dõi tiến độ và thống kê.</p><div class="auth-illustration"><span></span><span></span><span></span><span></span></div></div>
 <div class="auth-form-area"><div class="auth-box"><span class="tag">KHÔNG GIAN LÀM VIỆC</span><h2>Đăng nhập hệ thống</h2><p>Nhập tên đăng nhập hoặc mã cán bộ do quản trị viên cấp. Không cần nhập email.</p><form id="form-auth">
 <div class="form-group"><label>Tên đăng nhập / Mã cán bộ</label><input class="field" name="username" type="text" pattern="[A-Za-z0-9]{3,30}" minlength="3" maxlength="30" required autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="Ví dụ: nv001 hoặc 001234"></div>
 <div class="form-group"><label>Mật khẩu</label><input class="field" name="password" type="password" minlength="6" required autocomplete="current-password" placeholder="Nhập mật khẩu của bạn"></div>
 <button class="btn btn-primary" type="submit">Đăng nhập →</button></form><p class="form-hint" style="margin-top:16px">Chưa có tài khoản hoặc quên mật khẩu? Liên hệ quản trị viên của đơn vị.</p></div></div></div>`}

async function refreshCloud(){
 const [dep,cam,ass,sub,prof]=await Promise.all([
  supa.from('departments').select('*').order('name'),
  supa.from('campaigns').select('*').order('created_at',{ascending:false}),
  supa.from('assignments').select('*'),
  supa.from('submissions').select('*'),
  supa.from('profiles').select('*').order('full_name')
 ]);
 for(const item of [dep,cam,ass,sub,prof])if(item.error)throw item.error;
 state.db={departments:dep.data,campaigns:cam.data,assignments:ass.data,submissions:sub.data,profiles:prof.data};
 state.profile=prof.data.find(p=>p.id===state.user?.id)||null;
}
async function init(){
 try{
  if(CLOUD){
   if(!window.supabase?.createClient){await new Promise((resolve,reject)=>{const js=document.createElement('script');js.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';js.onload=resolve;js.onerror=()=>reject(new Error('Không tải được thư viện Supabase. Kiểm tra Internet hoặc trình duyệt.'));document.head.appendChild(js)})}
   if(!window.supabase?.createClient)throw new Error('Thư viện Supabase không khả dụng.');
   supa=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
   const {data,error}=await supa.auth.getUser(); if(error && !/Auth session missing/i.test(error.message))throw error;
   state.user=data?.user||null;
   if(state.user)await refreshCloud();
   setInterval(async()=>{if(!state.user||state.modal||state.loading)return;try{await refreshCloud();render()}catch(err){console.warn('Auto refresh:',err)}},60000);
  }else state.db=loadDemo();
  render();
 }catch(err){console.error(err);el('app').innerHTML=`<div class="startup" style="padding:22px;text-align:center;flex-direction:column"><h2>Không thể mở dashboard</h2><p>${e(err.message||'Lỗi không xác định')}</p><button class="btn" onclick="location.reload()">Tải lại trang</button></div>`}
}
async function saveDepartment(name){
 if(CLOUD){const {error}=await supa.from('departments').insert({name});if(error)throw error;await refreshCloud()}
 else {state.db.departments.push({id:uid(),name});saveDemo()}
}
async function saveCampaign(v,departmentIds){
 if(CLOUD){
  const {data,error}=await supa.from('campaigns').insert({...v,created_by:state.user.id}).select().single();if(error)throw error;
  const {error:ae}=await supa.from('assignments').insert(departmentIds.map(department_id=>({campaign_id:data.id,department_id})));if(ae)throw ae;
  await refreshCloud();
 }else{
  const c={id:uid(),...v,created_at:new Date().toISOString()};state.db.campaigns.unshift(c);
  departmentIds.forEach(department_id=>state.db.assignments.push({id:uid(),campaign_id:c.id,department_id}));saveDemo();
 }
}
async function saveResponse(a,payload){
 const old=subOf(a.id);
 const item={assignment_id:a.id,user_id:CLOUD?state.user.id:'demo',progress:payload.progress,status:payload.progress===100?'completed':'in_progress',summary:payload.summary,answers:payload.answers,evidence_url:payload.evidence_url,updated_at:new Date().toISOString()};
 if(CLOUD){const {error}=await supa.from('submissions').upsert(item,{onConflict:'assignment_id'});if(error)throw error;await refreshCloud()}
 else {if(old)Object.assign(old,item);else state.db.submissions.push({id:uid(),...item});saveDemo()}
}
async function toggleCampaign(id){const c=getCampaign(id),newStatus=c.status==='active'?'closed':'active';
 if(CLOUD){const {error}=await supa.from('campaigns').update({status:newStatus}).eq('id',id);if(error)throw error;await refreshCloud()}
 else{c.status=newStatus;saveDemo()}
}
async function saveProfile(id,role,department_id,username){
 const normalized=String(username||'').trim().toLowerCase();
 if(!/^[a-z0-9]{3,30}$/.test(normalized))throw Error('Tên đăng nhập phải có 3–30 ký tự chữ không dấu hoặc số.');
 const {error}=await supa.from('profiles').update({role,department_id:department_id||null,username:normalized}).eq('id',id);if(error)throw error;await refreshCloud();
}
function parseQuestions(raw){return raw.split('\n').map(v=>v.trim()).filter(Boolean).map(v=>{
 let type='text',label=v;
 if(/^\[số\]/i.test(v)){type='number';label=v.replace(/^\[số\]\s*/i,'')}
 else if(/^\[có\/không\]/i.test(v)){type='yesno';label=v.replace(/^\[có\/không\]\s*/i,'')}
 else if(/^\[văn bản\]/i.test(v)){label=v.replace(/^\[văn bản\]\s*/i,'')}
 return {type,label:label.slice(0,300)};
 }).filter(q=>q.label).slice(0,30)}
function csvCell(v){const raw=String(v??'').replace(/^[\s]*([=+@-])/,'\' $1');return '"'+raw.replace(/"/g,'""')+'"'}
function exportCSV(campaignId=null){const head=['Yêu cầu','Loại','Phòng ban','Hạn nộp','Trạng thái','Tiến độ (%)','Kết quả / Nhận xét','Chi tiết khảo sát','Minh chứng','Ngày cập nhật'];
 const rows=(campaignId?scopeAssignments().filter(a=>a.campaign_id===campaignId):reportRows()).map(a=>{const c=getCampaign(a.campaign_id),s=subOf(a.id);const answers=c?.type==='survey'?(c.questions||[]).map((q,i)=>`${q.label}: ${s?.answers?.[i]??''}`).join(' | '):'';
 return [c?.title,c?.type==='survey'?'Khảo sát':'Công việc',deptName(a.department_id),prettyDay(c?.due_date),statusText(assignmentStatus(a)),progress(a),s?.summary||'',answers,s?.evidence_url||'',s?niceTime(s.updated_at):''];});
 const csv='\uFEFF'+[head,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`${campaignId?'bao-cao-dot-khao-sat':'bao-cao-don-vi'}-${localDay()}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Đã xuất báo cáo CSV. Có thể mở bằng Excel.');
}
function busy(target,b){if(target){target.disabled=b;if(b)target.dataset.original=target.textContent, target.textContent='Đang xử lý...';else if(target.dataset.original)target.textContent=target.dataset.original}}

// Định tuyến tương tác
 document.addEventListener('click',async ev=>{
 const target=ev.target.closest('[data-action]');if(!target)return;
 const action=target.dataset.action;
 if(action==='backdrop'&&ev.target!==target)return;
 if(action==='backdrop'||action==='close-modal'){state.modal=null;render();return}
 if(action==='menu'){state.menu=!state.menu;render();return}
 if(action==='navigate'){state.view=target.dataset.view;state.menu=false;state.modal=null;state.filter={search:'',type:'all',department:'all',status:'all'};render();return}
 
 if(action==='new-campaign'){state.modal={type:'new-campaign'};render();return}
 if(action==='new-department'){state.modal={type:'new-department'};render();return}
 if(action==='detail'){state.modal={type:'detail',id:target.dataset.id};render();return}
 if(action==='respond'){state.modal={type:'respond',assignmentId:target.dataset.assignment};render();return}
 if(action==='export'){exportCSV();return}
 if(action==='export-campaign'){exportCSV(target.dataset.id);return}
 if(action==='refresh'&&CLOUD){busy(target,true);try{await refreshCloud();render();toast('Đã đồng bộ dữ liệu mới nhất.')}catch(err){busy(target,false);toast(err.message,true)}return}
 if(action==='reset-demo'&&!CLOUD){if(confirm('Khôi phục dữ liệu dùng thử? Các nội dung nhập trên thiết bị này sẽ bị xóa.')){state.db=demoSeed();saveDemo();state.view='dashboard';state.modal=null;render();toast('Đã khôi phục dữ liệu mẫu.')}return}
 if(action==='change-password'&&CLOUD){state.modal={type:'password'};render();return}
 if(action==='logout'){const {error}=await supa.auth.signOut();if(error){toast(error.message,true);return}state.user=null;state.profile=null;state.db=null;render();return}
 if(action==='toggle-campaign'&&admin()){
  if(!confirm('Xác nhận thay đổi trạng thái yêu cầu này?'))return;
  busy(target,true);try{await toggleCampaign(target.dataset.id);state.modal={type:'detail',id:target.dataset.id};render();toast('Đã cập nhật trạng thái yêu cầu.')}catch(err){busy(target,false);toast(err.message,true)}return;
 }
 if(action==='save-profile'&&admin()&&CLOUD){const id=target.dataset.id,role=el('profile-role-'+id).value,department=el('profile-dep-'+id).value,username=el('profile-username-'+id).value;
  if(id===state.user.id&&role!=='admin'){toast('Không thể tự hạ vai trò quản trị của chính mình.',true);return}
  busy(target,true);try{await saveProfile(id,role,department,username);render();toast('Đã lưu tên đăng nhập, phòng ban và vai trò.')}catch(err){busy(target,false);toast(err.message,true)}return;
 }
 });
 document.addEventListener('change',ev=>{
  const t=ev.target;
  if(t.id==='demo-switch'&&!CLOUD){state.demoRole=t.value==='admin'?'admin':'staff';if(t.value!=='admin')state.demoDept=t.value;localStorage.setItem('donvi_demo_role',state.demoRole);localStorage.setItem('donvi_demo_dept',state.demoDept);state.filter={search:'',type:'all',department:'all',status:'all'};state.view='dashboard';state.modal=null;render();return}
  if(t.id==='campaign-type'){el('question-box')?.classList.toggle('hidden',t.value!=='survey');return}
  const map={'filter-type':'type','filter-status':'status','filter-department':'department'};
  if(map[t.id]){state.filter[map[t.id]]=t.value;render();return}
 });
 let filterTimer;
 document.addEventListener('input',ev=>{
  const t=ev.target;
  if(t.id==='range-progress'){const output=el('range-value');if(output)output.textContent=t.value+'%';return}
  if(t.id==='filter-search'){clearTimeout(filterTimer);filterTimer=setTimeout(()=>{
    state.filter.search=t.value;let pos=t.selectionStart;render();const field=el('filter-search');if(field){field.focus();field.setSelectionRange(Math.min(pos,field.value.length),Math.min(pos,field.value.length))}
  },220)}
 });
 document.addEventListener('submit',async ev=>{
  const form=ev.target;if(!['form-auth','form-department','form-campaign','form-response','form-password'].includes(form.id))return;
  ev.preventDefault();if(state.loading)return;
  state.loading=true;const submit=$('[type="submit"]',form);busy(submit,true);
  try{
   const fd=new FormData(form);
   if(form.id==='form-auth'){
    const username=String(fd.get('username')||'').trim().toLowerCase();
    const password=String(fd.get('password')||'');
    if(!/^[a-z0-9]{3,30}$/.test(username))throw Error('Tên đăng nhập cần 3–30 ký tự chữ không dấu hoặc số.');
    const {data,error}=await supa.functions.invoke('login-username',{body:{username,password}});
    if(error||!data?.access_token||!data?.refresh_token)throw Error('Tên đăng nhập hoặc mật khẩu không đúng, hoặc dịch vụ đăng nhập chưa sẵn sàng.');
    const {data:session,error:sessionError}=await supa.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
    if(sessionError||!session?.user)throw Error('Không thể tạo phiên đăng nhập. Vui lòng thử lại.');
    state.user=session.user;await refreshCloud();state.view='dashboard';render();toast('Đăng nhập thành công.');
   }else if(form.id==='form-password'){
    if(!CLOUD||!state.user)throw Error('Bạn cần đăng nhập trước khi đặt mật khẩu.');
    const p=String(fd.get('new_password')||''),confirmPassword=String(fd.get('confirm_password')||'');
    if(p.length<8)throw Error('Mật khẩu cần tối thiểu 8 ký tự.');
    if(p!==confirmPassword)throw Error('Hai lần nhập mật khẩu không khớp.');
    const {error}=await supa.auth.updateUser({password:p});if(error)throw error;
    state.modal=null;render();toast('Đã lưu mật khẩu. Từ lần sau bạn có thể đăng nhập bằng tên tài khoản và mật khẩu này.');
   }else if(form.id==='form-department'){
    if(!admin())throw Error('Không đủ quyền tạo phòng ban.');const name=String(fd.get('name')||'').trim();if(!name)throw Error('Vui lòng nhập tên phòng ban.');
    await saveDepartment(name);state.modal=null;render();toast('Đã thêm phòng ban.');
   }else if(form.id==='form-campaign'){
    if(!admin())throw Error('Không đủ quyền tạo yêu cầu.');const departmentIds=fd.getAll('departments').map(String);if(!departmentIds.length)throw Error('Hãy chọn ít nhất một phòng ban.');
    const title=String(fd.get('title')||'').trim(),type=String(fd.get('type')),due_date=String(fd.get('due'));
    if(!title||!due_date)throw Error('Vui lòng nhập đủ tiêu đề và hạn nộp.');
    const questions=type==='survey'?parseQuestions(String(el('campaign-questions')?.value||'')):[];
    if(type==='survey'&&!questions.length)throw Error('Khảo sát cần có ít nhất một câu hỏi.');
    await saveCampaign({title,type,description:String(fd.get('description')||'').trim(),due_date,status:'active',questions},departmentIds);
    state.modal=null;state.view='campaigns';render();toast(`Đã giao yêu cầu tới ${departmentIds.length} phòng ban.`);
   }else if(form.id==='form-response'){
    const a=state.db.assignments.find(x=>x.id===form.dataset.assignment),c=a&&getCampaign(a.campaign_id);
    if(!a||!c||admin()||a.department_id!==currentDep()||c.status==='closed')throw Error('Bạn không có quyền cập nhật báo cáo này.');
    const answers={};if(c.type==='survey')(c.questions||[]).forEach((q,i)=>answers[i]=String(fd.get('q_'+i)||''));
    const progressValue=c.type==='survey'?100:Math.max(0,Math.min(100,Number(fd.get('progress'))||0));
    await saveResponse(a,{progress:progressValue,summary:String(fd.get('summary')||'').trim()||(c.type==='survey'?'Đã hoàn thành phiếu khảo sát.':''),answers,evidence_url:String(fd.get('evidence')||'').trim()});
    state.modal=null;render();toast('Đã lưu kết quả thực hiện thành công.');
   }
  }catch(err){console.error(err);toast(err.message||'Không lưu được dữ liệu.',true);busy(submit,false)}finally{state.loading=false}
 });
 init();
})();
