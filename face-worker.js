let face;
self.onmessage=async({data})=>{
 if(data.type==='init'){
  try{const {FilesetResolver,FaceLandmarker}=await import(new URL('./vendor/vision_bundle.mjs',self.location.href).href);const vision=await FilesetResolver.forVisionTasks(new URL('./vendor/',self.location.href).href);face=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('./vendor/face_landmarker.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numFaces:1,minFaceDetectionConfidence:.45,minFacePresenceConfidence:.45,minTrackingConfidence:.45});self.postMessage({type:'ready'});}catch(e){console.error('FACE-WORKER INIT FAILED:',e);self.postMessage({type:'error',message:e.message});}
 }else if(data.type==='frame'){
  try{const result=face.detectForVideo(data.bitmap,data.timestamp);self.postMessage({type:'result',landmarks:result.faceLandmarks[0]||null});}catch(e){self.postMessage({type:'error',message:e.message});}finally{data.bitmap.close();}
 }
};
