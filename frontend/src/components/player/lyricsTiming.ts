export interface LyricLine { time: number; text: string }
export function parseLrc(text: string): { lines: LyricLine[]; offsetSec: number } {
  const lines: LyricLine[]=[];
  const offset=text.match(/\[offset:\s*([+-]?\d+)\s*\]/i);
  const offsetSec=offset ? Number(offset[1])/1000 : 0;
  for(const raw of text.split(/\r?\n/)){
    const tags=[...raw.matchAll(/\[(\d{1,3}):(\d{2}(?:[.,]\d{1,3})?)\]/g)];
    if(!tags.length)continue;
    const content=raw.slice(tags[tags.length-1].index!+tags[tags.length-1][0].length).replace(/<\d{1,3}:\d{2}(?:\.\d{1,3})?>/g,'').trim();
    for(const tag of tags){const seconds=Number(tag[2].replace(',','.'));if(seconds>=60)continue;lines.push({time:Number(tag[1])*60+seconds,text:content});}
  }
  lines.sort((a,b)=>a.time-b.time);
  return {lines:lines.filter((line,i)=>!i || line.time!==lines[i-1].time || line.text!==lines[i-1].text),offsetSec};
}
export function activeLyricIndex(lines:LyricLine[], time:number):number {
  let lo=0,hi=lines.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(lines[mid].time<=time)lo=mid+1;else hi=mid;}
  return lo-1;
}
