
(() => {
  const $ = id => document.getElementById(id);
  const fields = ['hair','top','bottom','shoes','mask','face','action'];
  let assets = window.__alokPackedAssets || JSON.parse($('alok-data').textContent);
  delete window.__alokPackedAssets;
  const alokAssets={...assets};delete alokAssets.characters;
  const characterAssets={alok:alokAssets};
  delete assets.characters;
  const getVersion = () => window.currentAlokVersion || 'android-normal';
  const getVoice=()=> 'hanox';
  const selection = () => Object.fromEntries(fields.map(k => [k, Number($(k).value)]));
  const picked = (field, s=selection()) => assets.itemCatalog[field][s[field]];
  let downloading = false,exportAbort;
  function reportMod(p,step){const n=Math.max(Number($('mod-progress-bar').value)||0,Math.min(100,Math.floor(p)));$('mod-progress-bar').value=n;$('mod-progress-percent').textContent=n+'%';$('mod-progress-step').textContent=step;}
  function startMod(){exportAbort=new AbortController();$('mod-progress-bar').value=0;$('mod-progress-percent').textContent='0%';$('mod-progress').hidden=false;$('mod-cancel').disabled=false;reportMod(0,'Đang kiểm tra lượt mod…');}
  function checkCancelled(){if(exportAbort.signal.aborted)throw new DOMException('Đã hủy tạo file','AbortError');}
  $('mod-cancel').addEventListener('click',()=>{exportAbort?.abort();window.alokCancelExport();});

  let fourDownloadUrls=[];
  window.addEventListener('beforeunload',()=>fourDownloadUrls.forEach(url=>URL.revokeObjectURL(url)));
  const storageKey = () => 'wardrobe-selection-'+assets.characterId+'-' + getVersion();
  function fileForSelection(s=selection()) {

    if((!assets.voiceProfile?.enabled||getVoice()==='alok') && fields.every(k=>picked(k,s).default)) return assets.originals[getVersion()];
    return {dynamic:true, url:'alok-phoi-cheo-'+getVersion()+'.zip'};
  }
  function setDefaults() {
    fields.forEach(k => $(k).value = String(assets.itemCatalog[k].findIndex(i=>i.default)));
  }
  const fullSetHairIds=new Set(['hair-alien-x','hair-nguoi-nhen-full-set','hair-caption-american']);
  const headOnlyHairIds=new Set(['hair-chien-binh-tho','hair-tho-black','hair-tho-pink','hair-tho-purple','hair-tho-quay','hair-tho-red','hair-tho-thien-ha','hair-tho-white','hair-tho-yellow','hair-quai-nhan-hu-khong']);
  function applyFullSetHair(){
    const hairId=picked('hair').id;
    const clearFields=fullSetHairIds.has(hairId)?['top','bottom','shoes','mask','face']:headOnlyHairIds.has(hairId)?['mask','face']:[];
    for(const field of clearFields){
      const index=assets.itemCatalog[field].findIndex(item=>item.id===field+'-xoa');
      if(index>=0&&[...$(field).options].some(option=>option.value===String(index)))$(field).value=String(index);
    }
  }
  const noShoesBottomIds=new Set(['bottom-quai-nhan-hu-khong-black','bottom-quai-nhan-hu-khong-blue','bottom-quai-nhan-hu-khong-white']);
  function applyBottomShoes(){
    if(!noShoesBottomIds.has(picked('bottom').id))return;
    const index=assets.itemCatalog.shoes.findIndex(item=>item.id==='shoes-xoa');
    if(index>=0&&[...$('shoes').options].some(option=>option.value===String(index)))$('shoes').value=String(index);
  }
  const titanTopIds=new Set(['top-titan-tien-cong','top-titan-thiet-giap']);
  const titanMaskIds=new Set(['mask-titan-tien-cong','mask-titan-thiet-giap']);
  function applyTitanRules(source){
    const clearFields=source==='top'&&titanTopIds.has(picked('top').id)?['bottom','shoes']:source==='mask'&&titanMaskIds.has(picked('mask').id)?['face']:[];
    for(const field of clearFields){
      const index=assets.itemCatalog[field].findIndex(item=>item.id===field+'-xoa');
      if(index>=0&&[...$(field).options].some(option=>option.value===String(index)))$(field).value=String(index);
    }
  }
  function applyMordecai(source){
    if(source&&(!['hair','mask'].includes(source)||picked(source).id!==source+'-mordecai'))return;
    if(!source&&picked('hair').id!=='hair-mordecai'&&picked('mask').id!=='mask-mordecai')return;
    for(const field of ['hair','top','bottom','shoes','mask','face']){
      const id=field+'-'+(['hair','mask'].includes(field)?'mordecai':'xoa');
      const index=assets.itemCatalog[field].findIndex(item=>item.id===id);
      if(index>=0&&[...$(field).options].some(option=>option.value===String(index)))$(field).value=String(index);
    }
  }
  function populate() {
    const inv = assets.versionInventory[getVersion()];
    fields.forEach(k => {
      $(k).replaceChildren();
      assets.itemCatalog[k].map((item,index) => ({item,index})).sort((a,b) => a.item.name.localeCompare(b.item.name,'vi',{sensitivity:'base',numeric:true})).forEach(({item,index}) => {
        if(!inv[k].includes(item.id)) return;
        const option = new Option(item.name,String(index));
        option.dataset.itemId = item.id;
        $(k).add(option);
      });
    });
    setDefaults();
    let saved; try { saved=JSON.parse(localStorage.getItem(storageKey())); } catch {}
    if(saved && typeof saved==='object') fields.forEach(k => {
      const index=assets.itemCatalog[k].findIndex(i=>i.id===saved[k]);
      if([...$(k).options].some(o=>o.value===String(index))) $(k).value=String(index);
    });
    applyFullSetHair();applyTitanRules('top');applyBottomShoes();applyTitanRules('mask');applyMordecai();
  }
  function update() {
    const s=selection(), file=fileForSelection(s);
    const captions={hair:'Tóc',top:'Áo',bottom:'Quần',shoes:'Chân',mask:'Nạ',face:'Mặt',action:assets.characterId==='ignis'?'Nấm đấm':'Hành động'};
    $('selection-summary').textContent=fields.map(k=>captions[k]+': '+picked(k,s).name).join(' · ');
    if(assets.characterId==='alok')$('selection-summary').textContent+=' · Bản quyền HANOX MOD Z';
    try { localStorage.setItem(storageKey(),JSON.stringify(Object.fromEntries(fields.map(k=>[k,picked(k,s).id])))); } catch {}
    $('download').disabled = downloading || !file;
    $('download-all').disabled = downloading || !file;
    $('download-all-label').textContent = downloading ? 'Đang chuẩn bị file…' : 'Tạo 4 phiên bản';
    $('download-label').textContent = downloading ? 'Đang chuẩn bị file…' : file
      ? (file.dynamic ? 'Tạo file mod · '+(assets.mixEngine.bases[getVersion()].physicalSize/1048576).toFixed(2)+' MB' : (assets.characterId==='ignis'?'Tải file · ':'Tải '+assets.characterName+' gốc · ')+(file.bytes/1048576).toFixed(2)+' MB')
      : 'Bản phối này thiếu dữ liệu xuất';
    $('status').classList.remove('error');
    $('status').textContent = file
      ? (fields.every(k=>picked(k,s).default) ? 'File gốc của đúng phiên bản đang chọn.' : '')
      : assets.mixExportDeferred.includes(getVersion())
        ? 'Xuất file phối chéo cho phiên bản này sẽ bổ sung khi có thêm dữ liệu.'
        : 'Cách phối này thiếu dữ liệu xuất.';
    window.dispatchEvent(new CustomEvent('wardrobe-change',{detail:s}));
  }
  window.alokWardrobe={get assets(){return assets;},selection,getVersion,getVoice,picked,fileForSelection,ready:Promise.resolve(assets.manifest)};
  function updateCharacterLabels(){
    document.querySelector('.character-name').textContent=assets.characterName.toUpperCase();
    document.querySelector('.watermark').textContent=assets.characterName.toUpperCase();
    document.querySelector('.stage').setAttribute('aria-label','Xem trước nhân vật '+assets.characterName);
    $('fallback').alt=assets.characterName+' mặc bộ trang phục đang chọn';
    const isIgnis=assets.characterId==='ignis';
    const actionLabel=document.querySelector('label[for="action"]');
    actionLabel.lastChild.textContent=assets.characterId==='ignis'?'Nấm đấm':'Hành động';
  }
  $('character').addEventListener('change',()=>{
    if(downloading){$('character').value=assets.characterId;return;}
    const next=characterAssets[$('character').value];
    assets=next;
    assets.manifest.combinations=assets.versionCombinations[getVersion()]||{};
    populate();updateCharacterLabels();update();
  });
  updateCharacterLabels();
  populate();
  fields.forEach(k=>$(k).addEventListener('change',()=>{if(k==='hair')applyFullSetHair();if(k==='bottom')applyBottomShoes();if(k==='top'||k==='mask')applyTitanRules(k);if(k==='hair'||k==='mask')applyMordecai(k);update();}));
  $('wardrobe-form').addEventListener('submit',e=>e.preventDefault());
  $('reset').addEventListener('click',()=>{setDefaults();update();});
  $('randomize').addEventListener('click',()=>{
    const before=JSON.stringify(selection());
    for(let trial=0;trial<12;trial++) {
      fields.forEach(k=>{
        const options=[...$(k).options].filter(option=>assets.itemCatalog[k][Number(option.value)].id!==k+'-xoa');
        if(options.length)$(k).value=options[Math.floor(Math.random()*options.length)].value;
      });
      if(JSON.stringify(selection())!==before) break;
    }
    applyFullSetHair();applyTitanRules('top');applyBottomShoes();applyTitanRules('mask');applyMordecai();update();
  });
  const versionLabels={'android-normal':'Android · FF thường','android-max':'Android · FF MAX','ios-normal':'iOS · FF thường','ios-max':'iOS · FF MAX'};
  function updateVersionLabels(){
    $('platform-label').textContent=versionLabels[getVersion()];
    const count=$('wardrobe-intro').querySelector('.count');if(count)count.textContent=versionLabels[getVersion()];
  }
  $('version').addEventListener('change',()=>{
    if(downloading)return;
    const chosen=Object.fromEntries(fields.map(k=>[k,picked(k).id]));
    window.currentAlokVersion=$('version').value;
    try{localStorage.setItem('alok-current-version',getVersion());}catch{}
    assets.manifest.combinations=assets.versionCombinations[getVersion()]||{};
    populate();
    fields.forEach(k=>{
      const index=assets.itemCatalog[k].findIndex(item=>item.id===chosen[k]);
      if([...$(k).options].some(option=>option.value===String(index)))$(k).value=String(index);
    });
    updateVersionLabels();update();
  });
  window.addEventListener('alok-version-change',()=>{populate();updateVersionLabels();update();});
  updateVersionLabels();
  $('download').addEventListener('click',async()=>{
    const chosen=selection(), version=getVersion(), file=fileForSelection(chosen); if(!file || downloading) return;
    downloading=true; update();startMod();
    const controls=[...document.querySelectorAll('select, #randomize, #reset, #download-all')];controls.forEach(el=>el.disabled=true);
    try {
      const ticket=await window.hanoxCheckExport(1);
      checkCancelled();await window.alokEnsureExport(p=>reportMod(2+p*.18,'Đang tải dữ liệu xuất file…'),exportAbort.signal);checkCancelled();await new Promise(resolve=>requestAnimationFrame(resolve));
      let bytes;
      if(file.dynamic){
        bytes=await window.alokExport(chosen,version,p=>{
          reportMod(20+p*.7,'Đang ghép trang phục…');$('download-label').textContent='Đang tạo file… '+p+'%';
          $('status').textContent='Đang tạo file đúng các món và phiên bản bạn chọn.';
        });
      }else{
        const encoded=assets.downloads[file.url];if(!encoded)throw Error('Thiếu dữ liệu ZIP');
        const binary=atob(encoded);bytes=new Uint8Array(binary.length);
        for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
        if(bytes.length!==file.bytes)throw Error('File không đầy đủ');
      }
      const packaged=window.alokPackageDownload(bytes,version);
      checkCancelled();reportMod(95,'Đang hoàn tất file…');$('mod-cancel').disabled=true;await window.hanoxChargeExport(ticket);
      const url=URL.createObjectURL(new Blob([packaged.bytes],{type:'application/zip'}));
      const link=document.createElement('a');link.href=url;link.download=packaged.name;
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      controls.forEach(el=>el.disabled=false);downloading=false;$('mod-progress').hidden=true;update();$('status').textContent=(assets.characterId==='ignis'&&picked('top',chosen).id==='top-sasuke'?'Đã xuất áo Sasuke theo dữ liệu IG38.':'Đã tải file ZIP của đúng bộ đang chọn.');
    } catch(err) {
      controls.forEach(el=>el.disabled=false);downloading=false;$('mod-progress').hidden=true;update();$('status').classList.add('error');$('status').textContent=err.name==='AbortError'?'Đã hủy tạo file.':'Không tải được file: '+err.message;
    }
  });
  $('download-all').addEventListener('click',async()=>{
    if(downloading)return;
    const chosen=selection();
    downloading=true;update();startMod();
    const controls=[...document.querySelectorAll('select, #randomize, #reset')];controls.forEach(el=>el.disabled=true);
    try{
      const ticket=await window.hanoxCheckExport(4);
      checkCancelled();await window.alokEnsureExport(p=>reportMod(2+p*.18,'Đang tải dữ liệu xuất file…'),exportAbort.signal);checkCancelled();await new Promise(resolve=>requestAnimationFrame(resolve));
      const files=await window.alokExportAll(chosen,(p,label)=>{
        reportMod(20+p*.7,'Đang tạo '+label+'…');$('download-all-label').textContent='Đang tạo 4 phiên bản… '+p+'%';
        $('status').textContent='Đang tạo '+label+' từ cùng bộ phối đã chọn.';
      });
      fourDownloadUrls.forEach(url=>URL.revokeObjectURL(url));fourDownloadUrls=[];
      const fileVersions={'Android_FF_THUONG.zip':'android-normal','Android_FF_MAX.zip':'android-max','iOS_FF_THUONG.zip':'ios-normal','iOS_FF_MAX.zip':'ios-max'};
      const readyFiles=Object.entries(files).map(([name,bytes])=>window.alokPackageDownload(bytes,fileVersions[name]));
      if(readyFiles.length!==4)throw Error('Chưa tạo đủ 4 phiên bản.');
      checkCancelled();reportMod(95,'Đang hoàn tất file…');$('mod-cancel').disabled=true;await window.hanoxChargeExport(ticket);
      for(const packaged of readyFiles){
        const url=URL.createObjectURL(new Blob([packaged.bytes],{type:'application/zip'}));fourDownloadUrls.push(url);
        const link=document.createElement('a');link.href=url;link.download=packaged.name;link.style.display='none';
        document.body.append(link);link.click();link.remove();
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      controls.forEach(el=>el.disabled=false);downloading=false;$('mod-progress').hidden=true;update();
      $('status').textContent='Đã tạo và bắt đầu tải 4 phiên bản.';
    }catch(err){
      controls.forEach(el=>el.disabled=false);downloading=false;$('mod-progress').hidden=true;update();$('status').classList.add('error');$('status').textContent=err.name==='AbortError'?'Đã hủy tạo file.':'Không tải được 4 phiên bản: '+err.message;
    }
  });
  update();
})();

