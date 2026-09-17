// Original SVG compositions based on the image descriptions in cards.ts.
// Coordinates describe the inner 18,58–222,330 picture; frames belong to the generator.
const ink = '#30253b', paper = '#f5ebdd', gold = '#d5b47a', sage = '#4f5e48', violet = '#ac9bcb';
const path = (d, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const circle = (x,y,r,fill=paper,extra='') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const rect = (x,y,w,h,fill,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const star = (x,y,r=6,fill=gold) => path(`M${x} ${y-r} l${r*.26} ${r*.74} l${r*.74} ${r*.26} l-${r*.74} ${r*.26} l-${r*.26} ${r*.74} l-${r*.26}-${r*.74} l-${r*.74}-${r*.26} l${r*.74}-${r*.26} Z`,fill,'stroke="none"');
const sun = (x=174,y=96,r=24) => `${circle(x,y,r+9,gold,'opacity=".2" stroke="none"')}${circle(x,y,r,gold,'stroke="#b8955a"')}`;
const ground = (night=false) => path('M18 240 Q72 214 120 242 T222 234 V330 H18 Z',night?'#4a3a5c':sage,'stroke="none"');
const mountains = (night=false) => path('M18 224 L58 174 L88 202 L135 143 L184 202 L208 182 L222 200 V330 H18 Z',night?'#564663':'#b4a1be','stroke="none"')+path('M18 258 L82 220 L120 237 L163 199 L222 237 V330 H18 Z',night?'#3b304d':'#d4c4d3','stroke="none"');
const sky = (night=false) => rect(18,58,204,272,night?'url(#sky)':'url(#day)','stroke="none"') + (night?[[40,80],[190,75],[68,115],[201,155],[37,181]].map(([x,y])=>star(x,y,2,paper)).join(''):'');
const crown = (x,y) => path(`M${x-12} ${y} l-3-12 l10 6 l5-11 l5 11 l10-6 l-3 12 Z`,gold);
const head = (x,y,hair=ink) => `${path(`M${x-10} ${y+3} q-5-22 10-22 q15 0 11 23 Z`,hair)}${circle(x,y,10,paper)}${path(`M${x-5} ${y-2} h2 m6 0 h2 m-7 7 q3 2 6 0`,'none','stroke-width=".8"')}`;
const robe = (x,y,color=paper) => path(`M${x-15} ${y} Q${x-26} ${y+27} ${x-29} ${y+72} Q${x} ${y+82} ${x+29} ${y+72} Q${x+26} ${y+27} ${x+15} ${y} Z`,color)+path(`M${x-6} ${y+11} l-8 53 m22-48 l8 46`,'none','stroke-width=".8" opacity=".45"');
const arm = (d) => path(d,paper);
const pillar = (x,dark=false) => `${rect(x,117,24,154,dark?ink:'#ded4c8')}${rect(x-3,109,30,9,gold)}${rect(x-3,271,30,10,gold)}${path(`M${x+7} 123 v140 m10-140 v140`,'none','stroke="#b8955a" opacity=".6" stroke-width=".8"')}`;
const wings = (x,y,fill=violet) => path(`M${x-9} ${y+28} Q${x-38} ${y-22} ${x-80} ${y-27} Q${x-76} ${y+5} ${x-38} ${y+30} L${x-12} ${y+48} M${x+9} ${y+28} Q${x+38} ${y-22} ${x+80} ${y-27} Q${x+76} ${y+5} ${x+38} ${y+30} L${x+12} ${y+48}`,fill);
const cup = (x,y,s=1) => `<g transform="translate(${x} ${y}) scale(${s})">${path('M-9 0 Q-8 17 0 17 Q8 17 9 0 Z',gold)}${path('M0 17 v9 m-7 0 h14')}</g>`;
const flower = (x,y) => `${[0,72,144,216,288].map(a=>`<ellipse cx="${x}" cy="${y-4}" rx="2.3" ry="4" fill="${paper}" stroke="none" transform="rotate(${a} ${x} ${y})"/>`).join('')}${circle(x,y,2,gold,'stroke="none"')}`;
const tree = (x,y) => path(`M${x} ${y} v65 m0-48 l-14-15 m14 29 l19-23`,'none','stroke="#4f5e48" stroke-width="4"')+circle(x-10,y-2,18,sage,'stroke="none"')+circle(x+12,y+7,21,sage,'stroke="none"');
const infinity = (x,y) => path(`M${x} ${y} c-26-24-26 24 0 0 c26-24 26 24 0 0`,'none','stroke="#b8955a" stroke-width="2"');
const figure = (x,y,color=paper) => robe(x,y+14,color)+head(x,y);
const clouds = (y=115) => path(`M18 ${y} q10-18 25-5 q16-23 31-2 q15-12 28 6 h30 q12-22 28-6 q15-22 30-4 q18-10 32 8 v30 H18 Z`,paper,'stroke="none" opacity=".55"');
const witness = (x,y,type,book=false) => {
  const wing = path(`M${x-5} ${y+4} q-12-16-17-13 q0 17 18 22 M${x+5} ${y+4} q12-16 17-13 q0 17-18 22`,violet,'stroke-width=".8"');
  const face = type==='eagle'
    ? circle(x,y,8,paper)+path(`M${x+5} ${y-2} l10 5 l-10 2 Z`,gold)+circle(x+2,y-2,1,ink,'stroke="none"')
    : type==='lion'
      ? circle(x,y,12,gold)+circle(x,y,7,'#e3c68e')+path(`M${x-6} ${y-4} l-1-5 l5 3 m5 0 l5-3 l-1 5 M${x-2} ${y+2} l2 2 l2-2`,'none','stroke-width="1"')
      : type==='bull'
        ? path(`M${x-7} ${y-4} q-9-2-8-11 q6 8 12 6 M${x+7} ${y-4} q9-2 8-11 q-6 8-12 6`,gold)+circle(x,y,8,'#c8b6a6')+rect(x-6,y+2,12,6,'#ded0c0','rx="3"')
        : head(x,y);
  return `<g stroke-width="1">${wing}${face}${book?path(`M${x-11} ${y+9} l11 3 l11-3 v14 l-11 3 l-11-3 Z`,paper)+path(`M${x} ${y+12} v14`):''}</g>`;
};

export const SCENES = {
  'major-01-magician': sky()+ground()+infinity(120,104)+robe(120,162,'#965c68')+head(120,148)+
    arm('M106 166 L82 140 L70 110 L63 112 L74 150 L103 184 Z')+path('M63 90 l5 35','none','stroke="#d5b47a" stroke-width="5"')+
    arm('M134 166 L155 190 L169 232 L162 236 L146 200 L128 183 Z')+
    rect(55,226,130,12,'#b8955a')+path('M65 238 v67 m110-67 v67','none','stroke="#b8955a" stroke-width="7"')+
    cup(80,205,.65)+path('M97 213 l24-13 m-18 5 l5 8','none','stroke="#c4b9d0" stroke-width="3"')+
    path('M130 215 l23-14','none','stroke="#4f5e48" stroke-width="4"')+circle(166,212,10,gold)+star(166,212,7,ink)+
    [39,54,193,207].map((x,i)=>path(`M${x} 320 v-28`,'none','stroke="#4f5e48"')+flower(x,285+i%2*8)).join(''),
  'major-02-high-priestess': sky(true)+rect(73,126,94,155,'#6e526d')+
    [89,119,149].flatMap(x=>[149,183,217].map(y=>circle(x,y,6,'#a66d7b')+path(`M${x-3} ${y-6} l3-3 l3 3`,gold))).join('')+
    pillar(41,true)+pillar(175)+`<g fill="${gold}" stroke="none" font-family="Georgia" font-size="18"><text x="46" y="164">B</text><text x="182" y="164">J</text></g>`+
    robe(120,196,'#8b9bb8')+head(120,176)+circle(120,153,9,paper)+path('M106 151 q14 18 28 0','none','stroke="#d5b47a" stroke-width="3"')+
    arm('M105 208 Q97 224 101 236 L123 240 L125 232 L111 229 L115 211 Z')+rect(111,225,34,21,paper,'rx="3" transform="rotate(12 111 225)"')+
    path('M135 282 a19 19 0 1 1-19-25 a16 16 0 0 0 19 25 Z',gold),
  'major-03-empress': sky()+tree(39,145)+tree(201,138)+ground()+path('M185 192 Q154 226 178 255 T185 330 H164 Q186 286 159 260 T169 192 Z','#9fb0c8','stroke="none"')+
    path('M68 211 q42-38 78 3 l12 65 H58 Z','#a66d7b')+robe(115,203,paper)+head(115,184)+crown(115,172)+
    path('M128 214 Q153 224 159 249 L150 256 L124 232 Z',paper)+path('M93 215 l-20-3 l-12-34','none','stroke="#d5b47a" stroke-width="4"')+circle(59,173,7,gold)+
    path('M164 268 c-22-24-39 6 0 30 c39-24 22-54 0-30 Z',gold)+circle(164,278,6,'none')+path('M164 284 v9 m-4-3 h8')+
    [29,42,57,73,192,208].map(x=>path(`M${x} 330 q-4-20 0-37 m0 13 l-6-8 m6 2 l7-8 m-7 20 l-6-6 m6 1 l7-7`,'none',`stroke="${gold}" stroke-width="2"`)).join(''),
  'major-04-emperor': sky()+mountains()+rect(74,134,92,160,'#98919b')+rect(65,181,17,112,'#bbb0b8')+rect(158,181,17,112,'#bbb0b8')+
    [80,160].map(x=>circle(x,143,9,'#d6c7c1')+path(`M${x-8} 144 q-14-22-8-23 q16 0 11 17 m13 6 q14-22 8-23 q-16 0-11 17`,'none','stroke="#b8955a" stroke-width="2"')).join('')+
    robe(120,198,'#9c5960')+head(120,179,'#d0c6c0')+crown(120,166)+path('M108 185 q12 32 24 0 l-4 29 h-16 Z','#d0c6c0')+
    path('M108 268 l-7 33 h16 l6-31 M130 269 l5 33 h17 l-9-35','#95949e')+path('M85 203 v66','none',`stroke="${gold}" stroke-width="3"`)+circle(85,198,6,'none')+path('M76 210 h18','none',`stroke="${gold}" stroke-width="3"`)+circle(151,227,10,gold),
  'major-05-hierophant': sky()+pillar(43)+pillar(174)+rect(91,143,58,134,'#b7a3b8')+robe(120,184,'#a66d7b')+head(120,161)+crown(120,148)+crown(120,139)+
    arm('M103 191 L84 177 L82 154 L74 155 L75 184 L98 210 Z')+path('M156 140 v123 m-10-108 h20 m-13 12 h26 m-16 12 h32','none',`stroke="${gold}" stroke-width="3"`)+
    path('M99 278 l41 27 m0-27 l-41 27','none',`stroke="${gold}" stroke-width="3"`)+circle(98,277,6,'none')+circle(140,277,6,'none')+
    `<g transform="translate(0 50) scale(1 .85)">${figure(69,268,'#8b9bb8')}${figure(172,268,'#a66d7b')}</g>`,
  'major-06-lovers': sky()+sun(120,87,22)+mountains()+ground()+wings(120,139)+head(120,127)+robe(120,142,'#8b9bb8')+
    tree(43,220)+path('M39 243 q14-6 5-15 q-12-9-3-18','none','stroke="#b8955a" stroke-width="3"')+
    path('M201 281 v-72','none','stroke="#9c5960" stroke-width="4"')+[217,237,254].map(y=>path(`M201 ${y} q-20-7-11-22 q1 11 11 12 q8-18 11-10 q8 15-11 20`,gold,'stroke="none"')).join('')+
    `<g transform="translate(0 56) scale(1 .84)">${figure(85,239,paper)}${figure(154,239,'#ded0c0')}</g>`+
    path('M96 267 l13 8 m33-8 l-13 8','none',`stroke="${paper}" stroke-width="6"`),
  'major-07-chariot': sky()+path('M18 213 v-36 h18 v-18 h20 v42 h15 v-29 h20 v44 h44 v-39 h22 v-26 h17 v54 h22 v-42 h20 v50 Z','#b4a1be')+
    rect(64,98,112,30,'#4a3a5c')+[79,108,137,164].map(x=>star(x,111,5)).join('')+path('M67 127 v122 m106-122 v122','none','stroke="#b8955a" stroke-width="4"')+
    robe(120,166,'#8b9bb8')+head(120,147)+crown(120,136)+rect(70,216,100,58,'#c6c0c5')+circle(120,239,13,gold)+star(120,239,9,paper)+
    [75,166].map((x,i)=>`<g fill="${i?paper:ink}" stroke="#b8955a">${path(`M${x-22} 312 q-10-21 0-30 l15-7 l18 2 l15 35 Z`,i?paper:ink)}${circle(x,275,13,i?paper:ink)}${path(`M${x-14} 275 l5-17 h18 l5 17 Z`,i?paper:ink)}${path(`M${x-20} 315 h38`,'none','stroke-width="3"')}</g>`).join(''),
  'major-08-strength': sky()+mountains()+ground()+infinity(106,131)+robe(106,184,paper)+head(106,164)+
    path('M114 212 Q142 202 157 216 L153 224 Q138 219 119 229 Z',paper)+
    path('M83 212 Q98 245 129 250 L134 242 Q108 237 99 211 Z',paper)+
    path('M131 267 Q165 249 191 272 L202 300 L192 307 L180 285 L158 286 L156 309 L144 308 L141 286 L124 284 Z','#c89d5f')+
    circle(134,260,24,'#b8955a')+circle(132,256,14,'#e3c68e')+path('M119 259 q14 8 24-2 M123 249 h3 m9-1 h3 M194 278 q24 18 8 31 q-10 7-16-1')+
    [93,103,113,123].map(x=>flower(x,209)).join(''),
  'major-09-hermit': sky(true)+mountains(true)+path('M18 309 l53-24 l43 12 l43-28 l65 37 v24 H18 Z','#d9d5df')+
    path('M116 173 Q86 202 83 283 L150 286 Q147 222 134 176 Z','#9994a4')+path('M119 160 q-26 5-19 32 l17-5 l22 7 q7-28-20-34 Z','#b8b0bf')+head(120,181,'#b8b0bf')+
    path('M112 187 q8 28 15 2 l-4 30 Z',paper)+arm('M112 202 L88 216 L72 195 L65 201 L82 229 L118 220 Z')+
    path('M142 192 v113','none','stroke="#b8955a" stroke-width="4"')+rect(44,175,29,37,'#211b30','rx="3" stroke="#d5b47a"')+path('M48 175 l10-11 l11 11','none',`stroke="${gold}"`)+path('M58 183 l9 16 H49 Z M58 205 l9-16 H49 Z','none',`stroke="${gold}" stroke-width="1.3"`),
  'major-10-wheel': sky(true)+clouds(95)+circle(120,211,64,gold)+circle(120,211,51,'#4a3a5c')+circle(120,211,28,gold)+circle(120,211,7,paper)+
    [0,45,90,135].map(a=>path('M120 162 v98','none',`stroke="#d5b47a" stroke-width="1.5" transform="rotate(${a} 120 211)"`)).join('')+
    `<g fill="${ink}" stroke="none" font-family="Georgia" font-size="13"><text x="115" y="159">T</text><text x="172" y="216">A</text><text x="115" y="273">R</text><text x="58" y="216">O</text></g>`+
    path('M93 144 l15-16 h21 l17 16 Z','#8b9bb8')+head(120,118)+path('M139 108 l16 36','none',`stroke="${paper}" stroke-width="3"`)+
    path('M49 168 q-33 22-15 48 t5 34','none','stroke="#b8955a" stroke-width="7"')+path('M190 270 q27-34 9-65 l-8 6 q10 31-15 49 Z','#a66d7b')+
    witness(40,91,'human',true)+witness(198,91,'eagle',true)+witness(40,299,'bull',true)+witness(198,299,'lion',true),
  'major-11-justice': sky()+rect(69,118,104,161,'#745771')+pillar(39)+pillar(177)+robe(120,189,'#a66d7b')+head(120,170)+crown(120,157)+
    path('M83 181 v72','none',`stroke="${paper}" stroke-width="5"`)+path('M73 233 h20','none',`stroke="${gold}" stroke-width="3"`)+
    arm('M133 202 L158 203 L159 193 L169 193 L169 214 L130 215 Z')+path('M162 184 v37 m-24-7 h48 m-45 0 l-9 26 h19 l-10-26 m42 0 l-9 26 h19 l-10-26','none',`stroke="${gold}" stroke-width="2"`)+
    path('M125 266 l12 23 l-2 14 h-21 l5-35 Z',paper)+rect(116,148,8,8,'#8b9bb8'),
  'major-12-hanged-man': sky()+ground()+path('M51 329 v-220 M45 112 h150','none','stroke="#746447" stroke-width="11"')+
    [65,93,154,181].map(x=>path(`M${x} 109 q-10-19 3-24 q12 13-3 24 Z`,sage)).join('')+
    path('M127 111 l-3 39','none','stroke="#d5b47a" stroke-width="3"')+path('M119 143 L131 144 L125 197 L115 218 L96 212 L89 196 L104 182 L113 187 L104 198 L113 204 Z','#a66d7b')+
    path('M99 210 L123 211 L137 255 L93 255 Z','#8b9bb8')+path('M98 219 l-15 15 l15 15 m25-30 l19 14 l-13 20','none',`stroke="${paper}" stroke-width="7"`)+circle(115,273,25,gold,'opacity=".4" stroke="none"')+head(115,271),
  'major-13-death': sky()+rect(177,170,12,62,'#b4a1be')+rect(210,170,12,62,'#b4a1be')+sun(199,205,12)+path('M18 250 Q106 230 222 245 V330 H18 Z','#8b9bb8','stroke="none"')+
    path('M41 262 Q41 228 82 223 L113 220 L147 206 L163 209 L166 234 L151 244 L140 233 L127 247 L131 291 L118 302 L111 258 L70 258 L62 295 L48 296 L53 258 Z',paper)+
    path('M142 211 l3-17 l11 15 M51 235 q-30 3-22 26','none',`stroke="${paper}" stroke-width="5"`)+circle(154,222,2,ink)+
    robe(84,177,ink)+head(84,161,paper)+path('M78 161 h3 m6 0 h3 m-9 7 h8','none','stroke-width="2"')+path('M87 205 l26 24 l-9 28','none','stroke="#9994a4" stroke-width="8"')+
    path('M113 133 v117','none',`stroke="${gold}" stroke-width="3"`)+path('M114 135 q20-8 40 0 v44 q-20-9-40 0 Z',ink)+flower(134,157)+
    crown(59,316)+`<g transform="translate(74 130) scale(.52)">${figure(160,228,'#a66d7b')}</g>`+path('M151 242 l7-18 l7 18 Z',paper)+`<g transform="translate(128 189) scale(.39)">${figure(160,228,'#8b9bb8')}</g><g transform="translate(173 228) scale(.25)">${figure(160,228,paper)}</g>`,
  'major-14-temperance': sky()+sun(120,100,17)+mountains()+ground()+path('M134 185 Q108 215 146 241 T142 330 H111 Q142 271 111 241 T127 185 Z','#c8ac7c','stroke="none"')+
    path('M18 282 Q89 271 134 295 L155 330 H18 Z','#8b9bb8')+wings(120,171,'#b695ad')+robe(120,181,paper)+head(120,163)+circle(120,152,3,gold)+
    path('M120 202 l10 17 h-20 Z',gold)+path('M107 260 l-13 31 h15 l8-26 M130 260 l11 32 h16 l-18-37',paper)+
    arm('M105 188 L88 200 L77 195 L72 203 L89 212 L111 203 Z')+arm('M134 188 L147 214 L160 218 L159 227 L137 221 L127 201 Z')+
    cup(75,193,.75)+cup(160,222,.75)+path('M81 201 Q127 204 159 224','none','stroke="#9fb0c8" stroke-width="3"')+
    path('M48 309 v-26 m0 9 l-8-8 m8 20 l9-13','none',`stroke="${sage}" stroke-width="3"`),
  'major-15-devil': sky(true)+path('M18 308 L56 270 L110 278 L173 253 L222 288 V330 H18 Z','#3b304d','stroke="none"')+
    wings(120,147,'#4a3a5c')+rect(91,218,58,50,ink)+robe(120,158,'#8f8193')+head(120,145,'#8f8193')+
    path('M111 129 q-18-23-18-1 l13 8 M129 129 q18-23 18-1 l-13 8',gold)+
    arm('M104 176 L82 158 L80 136 L72 136 L73 167 L103 194 Z')+path('M147 190 l22 44','none',`stroke="${gold}" stroke-width="5"`)+path('M168 231 q-10 12 0 20 q14-9 0-20 Z','#e3c68e')+
    `<g transform="translate(17 163) scale(.54)">${figure(82,226,paper)}${figure(290,226,'#ded0c0')}</g>`+
    path('M63 289 Q60 322 102 318 Q119 317 120 265 Q121 317 138 318 Q180 322 177 289','none',`stroke="${gold}" stroke-width="2" stroke-dasharray="4 3"`)+circle(120,265,5,gold),
  'major-18-moon': sky(true)+mountains(true)+circle(120,111,30,gold)+path('M128 84 q-29 27 0 53 q-9-12-7-25 q-2-15 7-28 Z',paper)+path('M112 103 q5-4 9 0 m-8 16 q5 3 10-1','none','stroke-width="1"')+
    rect(35,174,25,91,'#9994a4')+rect(182,174,25,91,'#9994a4')+path('M35 173 v-9 h8 v8 h9 v-8 h8 v9 M182 173 v-9 h8 v8 h9 v-8 h8 v9','#9994a4')+
    ground(true)+path('M109 330 Q159 287 124 259 T139 216 L133 216 Q107 241 115 261 T97 330 Z','#c8ac7c','stroke="none"')+
    [74,166].map((x,i)=>path(`M${x-16} 280 l7-28 l10-6 l2-18 l9 13 l-5 22 l10 16 l-10 1 l-6-13 l-5 14 Z`,i?'#b4a1be':paper)).join('')+
    path('M18 306 Q88 288 139 307 T222 310 V330 H18 Z','#8b9bb8','stroke="none"')+
    path('M115 309 q-7 10 0 16 q7-6 0-16 M112 317 l-9-8 m15 8 l9-8 m-14 16 l-9-1 m13 1 l9-1','none','stroke="#b8955a" stroke-width="2"')+
    [75,97,142,166].map((x,i)=>path(`M${x} ${148+i%2*10} l-2 8 l5-2 Z`,gold,'stroke="none"')).join(''),
  'major-19-sun': sky()+sun(120,108,38)+path('M105 105 q5-4 10 0 m10 0 q5-4 10 0 m-22 16 q8 5 16 0','none','stroke="#b8955a"')+
    rect(18,216,204,69,'#c8b6a6')+path('M18 238 h204 m-204 23 h204 m-174-45 v22 m42-22 v22 m45-22 v22 m45-22 v22 m-151 1 v23 m42-23 v23 m43-23 v23 m45-23 v23','none','stroke="#b8955a" stroke-width="1"')+
    [38,65,175,202].map(x=>path(`M${x} 226 v-39`,'none',`stroke="${sage}" stroke-width="3"`)+circle(x,185,12,gold)+circle(x,185,5,'#8b6748')).join('')+
    path('M49 298 Q49 264 95 267 L139 270 L158 249 L176 253 L183 271 L176 282 L157 276 L145 296 L151 325 L137 325 L125 299 L80 299 L73 325 L61 325 L64 294 Z',paper)+
    path('M57 280 q-23 5-21 27','none',`stroke="${paper}" stroke-width="6"`)+circle(174,262,2,ink)+
    head(114,234)+path('M105 246 l-8 24 h26 l-4-24 Z',paper)+path('M119 267 l14 17 l-5 15','none',`stroke="${paper}" stroke-width="7"`)+flower(109,223)+flower(119,223)+
    path('M133 253 l20-10 M149 210 v91','none',`stroke="${gold}" stroke-width="3"`)+path('M150 211 q22-14 39 0 l-8 32 q-19-11-31 1 Z','#a66d7b'),
  'major-20-judgement': sky(true)+clouds(143)+wings(120,105,'#a66d7b')+head(120,104)+robe(120,120,'#8b9bb8')+
    path('M115 117 l-28 45 l20 11 l21-52 Z',gold)+path('M92 157 l30 5 l-3 38 l-30-5 Z',paper)+path('M104 168 v23 m-9-13 h20','none','stroke="#a66d7b" stroke-width="4"')+
    path('M18 254 Q120 239 222 259 V330 H18 Z','#8b9bb8','stroke="none"')+
    [62,120,181].map((x,i)=>path(`M${x-21} 290 l30-8 l14 31 l-35 8 Z`,'#6d6880')+`<g transform="translate(${x-120} ${i===1?68:51}) scale(1 .78)">${figure(120,226,'#c4becd')}</g>`+path(`M${x-8} ${i===1?268:252} l-12-24 m29 24 l13-24`,'none','stroke="#c4becd" stroke-width="7"')).join('')+
    path('M25 323 q40-10 75 0 m40-6 q38-8 73 0','none','stroke="#d3dbe5" stroke-width="1"'),
  'major-21-world': sky(true)+clouds(92)+`<ellipse cx="120" cy="210" rx="64" ry="99" fill="#4f5e48"/><ellipse cx="120" cy="210" rx="52" ry="87" fill="#4a3a5c"/>`+
    Array.from({length:20},(_,i)=>{const a=i*Math.PI/10,x=120+58*Math.cos(a),y=210+93*Math.sin(a);return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4" ry="9" fill="#a5ad88" stroke="none" transform="rotate(${i*18} ${x} ${y})"/>`;}).join('')+
    head(119,163)+path('M110 176 Q100 208 112 233 L119 237 L131 219 Q129 193 125 176 Z',paper)+
    path('M113 231 l-7 27 l16 32 l9-5 l-13-29 l9-20 Z',paper)+path('M126 230 l15 16 l-17 18 l-7-7 l12-11 l-12-12 Z',paper)+
    arm('M109 184 L88 204 L80 201 L77 209 L91 215 L118 196 Z')+arm('M126 184 L145 193 L156 184 L163 188 L149 206 L123 197 Z')+
    path('M76 191 l6 34 m78-53 l-4 36','none',`stroke="${gold}" stroke-width="3"`)+path('M104 198 Q147 194 133 223 L103 241 L95 233 Q132 215 111 211 Z',violet)+
    witness(41,92,'human')+witness(198,92,'eagle')+witness(41,306,'bull')+witness(198,306,'lion'),
};
