(() => {
const toggle=document.getElementById('hanox-menu-toggle'),menu=document.getElementById('hanox-menu');
function setOpen(open){menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));}
toggle.addEventListener('click',()=>setOpen(menu.hidden));
document.addEventListener('click',event=>{if(!event.target.closest('.hanox-nav'))setOpen(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){setOpen(false);toggle.focus();}});
})();
