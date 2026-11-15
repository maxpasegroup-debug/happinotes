/** A Firebase Web Auth page opened by Expo Go's system browser, never a WebView. */
export function googleBrowserPage(sessionId: string, firebase: Record<string, string>, nonce: string) {
  const config = JSON.stringify({ sessionId, firebase }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HappiNotes — Google sign-in</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#fff8ec;color:#30221c;font-family:system-ui,sans-serif}main{width:100%;max-width:420px}small{color:#ad511a;font-weight:700;letter-spacing:.1em}h1{font-size:30px;line-height:1.2;margin:16px 0}p{line-height:1.6;color:#6b625c}button{width:100%;min-height:50px;border:1px solid #ded4c9;border-radius:16px;background:white;font:600 16px system-ui;padding:12px;cursor:pointer}button:disabled{opacity:.5;cursor:default}#cancel{margin-top:12px;background:transparent;border-color:transparent}#status{min-height:54px}button:focus-visible{outline:3px solid #f25f45;outline-offset:3px}</style></head>
<body><main><small>HAPPINOTES</small><h1>Continue with Google</h1><p>Choose your Google account, then return to HappiNotes in Expo Go to finish signing in.</p><button id="google" disabled>Continue with Google</button><button id="cancel">Cancel sign-in</button><p id="status" role="status" aria-live="polite">Loading secure sign-in…</p></main>
<script type="module" nonce="${nonce}">
const settings=${config};
const button=document.getElementById('google'), cancel=document.getElementById('cancel'), status=document.getElementById('status');
let auth, sdk, finished=false, busy=false;
async function finish(body){
 const response=await fetch('/auth/google/browser/complete',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:settings.sessionId,...body})});
 if(!response.ok)throw new Error('handoff');
 finished=true;button.hidden=true;cancel.hidden=true;
 status.textContent=body.cancelled?'Sign-in cancelled. Close this browser to return to HappiNotes.':'Google sign-in complete. Close this browser to return to HappiNotes in Expo Go.';
}
cancel.onclick=async()=>{if(busy||finished)return;busy=true;button.disabled=true;cancel.disabled=true;try{await finish({cancelled:true});}catch{status.textContent='Close this browser and cancel sign-in in HappiNotes.';}finally{busy=false;}};
try{
 const [app, authSdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js')]);
 sdk=authSdk;auth=sdk.getAuth(app.initializeApp(settings.firebase));
 await sdk.setPersistence(auth,sdk.inMemoryPersistence);
 button.disabled=false;status.textContent='Your Google password is entered only on Google’s sign-in page.';
 button.onclick=async()=>{
  if(busy||finished)return;busy=true;button.disabled=true;cancel.disabled=true;
  try{
   const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account',max_age:'0'});
   const result=await sdk.signInWithPopup(auth,provider);
   status.textContent='Completing sign-in…';
   await finish({firebaseIdToken:await result.user.getIdToken()});
  }catch(error){
   status.textContent=error?.code==='auth/popup-closed-by-user'?'Sign-in cancelled. You can try again or return to HappiNotes.':error?.code==='auth/popup-blocked'?'Allow the Google sign-in window in your browser and try again.':'Google sign-in could not finish. Return to HappiNotes and try again.';
  }finally{
   if(auth)await sdk.signOut(auth).catch(()=>{});
   busy=false;if(!finished){button.disabled=false;cancel.disabled=false;}
  }
 };
}catch{status.textContent='Google sign-in is unavailable. Return to HappiNotes and use email sign-in.';}
</script></body></html>`;
}
