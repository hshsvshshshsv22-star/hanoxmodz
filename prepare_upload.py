#!/usr/bin/env python3
"""Prepare HANOX MOD Z static assets for GitHub Pages deployment."""
import concurrent.futures, gzip, json, re, time, urllib.request, urllib.error
from pathlib import Path
BASE='https://hanoxmodz.github.io/botmodff/'
ROOT=Path(__file__).resolve().parent
PAYLOAD=ROOT/'wardrobe-b6178fca57b6.gz'
REPORT=ROOT/'UPLOAD_ASSETS_REPORT.txt'

def restore(v,pool):
    if isinstance(v,dict):
        if '__alok_shared_value__' in v:
            i=v['__alok_shared_value__']; return restore(pool[i],pool)
        return {k:restore(x,pool) for k,x in v.items()}
    if isinstance(v,list): return [restore(x,pool) for x in v]
    return v

def collect(v,out):
    if isinstance(v,str):
        s=v.removeprefix('./')
        if s.startswith('assets/runtime/') and re.fullmatch(r'assets/runtime/[A-Za-z0-9_.-]+',s): out.add(s)
    elif isinstance(v,dict):
        for x in v.values(): collect(x,out)
    elif isinstance(v,list):
        for x in v: collect(x,out)

def fetch(rel):
    dest=ROOT/rel; dest.parent.mkdir(parents=True,exist_ok=True)
    if dest.exists() and dest.stat().st_size>100: return rel,'EXISTS',dest.stat().st_size
    req=urllib.request.Request(BASE+rel,headers={'User-Agent':'Mozilla/5.0','Accept':'image/webp,image/*,*/*'})
    error='unknown'
    for i in range(3):
        try:
            with urllib.request.urlopen(req,timeout=35) as r: data=r.read(); ct=r.headers.get('Content-Type','')
            if len(data)<100 or data.lstrip().lower().startswith((b'<html',b'<!doctype html')): raise ValueError('not an image')
            tmp=dest.with_suffix(dest.suffix+'.part'); tmp.write_bytes(data); tmp.replace(dest)
            return rel,'OK',len(data)
        except Exception as e: error=f'{type(e).__name__}: {e}'; time.sleep(i+1)
    return rel,'FAILED',error

def main():
    try:
        packed=json.loads(gzip.decompress(PAYLOAD.read_bytes()).decode('utf-8'))
        data=restore(packed['root'],packed['pool']) if isinstance(packed,dict) and 'root' in packed and isinstance(packed.get('pool'),list) else packed
        paths=set(); collect(data.get('images',{}),paths)
        if not paths: raise ValueError('No assets/runtime paths found in payload')
    except Exception as e:
        print('Cannot read payload:',e); return 2
    print(f'Preparing {len(paths)} runtime images...')
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex: results=list(ex.map(fetch,sorted(paths)))
    ok=sum(s in ('OK','EXISTS') for _,s,_ in results); failed=[x for x in results if x[1]=='FAILED']
    REPORT.write_text(f'Source: {BASE}\nRuntime files: {len(paths)}\nAvailable: {ok}\nFailed: {len(failed)}\n\n'+''.join(f'{s}\t{p}\t{info}\n' for p,s,info in results),encoding='utf-8')
    print(f'Runtime images available: {ok}/{len(paths)}. Report: {REPORT.name}')
    if failed:
        print('Some files failed. Check report and retry before uploading.'); return 3
    print('Ready to upload this folder to GitHub Pages. The 4 default preview URLs on source may return 404; those are not runtime textures.')
    return 0
if __name__=='__main__': raise SystemExit(main())
