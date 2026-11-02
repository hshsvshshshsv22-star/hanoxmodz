(() => {
const params=new URLSearchParams(location.hash.slice(1));
if(params.has('access_token')||params.has('error_description')){
location.replace('./account.html'+location.hash);
}
})();
