let recognizer;
self.onmessage=async({data})=>{
 if(data.type==='init'){
  try{
   const {FilesetResolver,GestureRecognizer}=await import(new URL('./vendor/vision_bundle.mjs',self.location.href).href);
   const vision=await FilesetResolver.forVisionTasks(new URL('./vendor/',self.location.href).href);
   recognizer=await GestureRecognizer.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./vendor/gesture_recognizer.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.5});
   self.postMessage({type:'ready'});
  }catch(e){console.error('HAND-WORKER INIT FAILED:',e);self.postMessage({type:'error',message:e.message});}
 }else if(data.type==='frame'){
  try{
   const result=recognizer.recognizeForVideo(data.bitmap,data.timestamp);
   self.postMessage({type:'result',landmarks:result.landmarks[0]||null,gesture:result.gestures[0]?.[0]||null});
  }catch(e){self.postMessage({type:'error',message:e.message});}
  finally{data.bitmap.close();}
 }
};
