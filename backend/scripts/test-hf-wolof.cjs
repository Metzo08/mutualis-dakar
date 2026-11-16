require('dotenv').config({ path: __dirname + '/../.env' });
const hfKey = process.env.HUGGINGFACE_API_KEY;
console.log('HF Key present:', Boolean(hfKey));

async function testHfWolof() {
  const url = 'https://router.huggingface.co/hf-inference/models/facebook/mms-tts-wol';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + hfKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: 'Dalal ak jamm ci Mutualis Dakar' })
    });
    console.log('HF MMS Wolof status:', res.status, res.headers.get('content-type'));
    if (res.ok) {
      const buf = await res.arrayBuffer();
      console.log('HF MMS Wolof audio bytes:', buf.byteLength);
    } else {
      const txt = await res.text();
      console.log('HF error text:', txt);
    }
  } catch (e) {
    console.error('HF fetch err:', e.message, e.cause);
  }
}

testHfWolof();
