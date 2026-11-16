async function testOolelApi() {
  const text = "Dalal ak jamm ci Mutualis Dakar.";

  const res = await fetch('https://soynade-research-oolel-voices-demo.hf.space/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [
        text,
        null,
        0.3,
        0.2,
        0,
        0.5
      ]
    })
  });

  console.log('API predict status:', res.status);
  const data = await res.json();
  console.log('Result data:', data);
}

testOolelApi().catch(e => console.error(e));
