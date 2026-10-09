// Measurements transcribed from the supplied 390 × 694 design frames.
export const DESIGN_FRAME={width:390,height:694};
export const SAFE_ZONES={
 setupWithAlbum:{x:52,y:97,width:286,height:282},
 setupWithoutAlbum:{x:51,y:97,width:288,height:348},
 recordingCore:{x:65,y:82,width:260,height:451},
 recordingVisual:{x:19,y:82,width:352,height:464},
 atmosphere:{x:19,y:0,width:352,height:694}
};
export function zoneAt(name,width,height){const z=SAFE_ZONES[name];if(!z)throw new Error('Unknown safe zone');return{x:z.x/390*width,y:z.y/694*height,width:z.width/390*width,height:z.height/694*height};}
export function applySafeLayout(app){const z=SAFE_ZONES.recordingCore,v=SAFE_ZONES.recordingVisual,p=SAFE_ZONES.setupWithAlbum;for(const[k,n]of Object.entries({'--core-x':z.x/390,'--core-width':z.width/390,'--core-top':z.y/694,'--core-bottom':(z.y+z.height)/694,'--visual-x':v.x/390,'--visual-width':v.width/390,'--setup-x':p.x/390,'--setup-width':p.width/390})){app.style.setProperty(k,`${n*100}%`);}}
