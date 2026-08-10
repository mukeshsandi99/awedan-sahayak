#!/usr/bin/env bash
#
# Profiling runner — sends 30 requests to local DeepSeek-powered server
# with >= 2-minute spacing between requests.
#
# Usage: bash profiling/run-requests.sh
# Logs:  profiling/results.txt   — per-request HTTP status + timing
#        server stdout           — captured from background server task
#

set -euo pipefail

API_URL="http://localhost:3000/api/generate-application"
RESULT_FILE="profiling/results.txt"
PAYLOAD_FILE="profiling/payload.json"
COUNT=30
INTERVAL_SEC=125  # 2min 5s — a bit over 2 min to be safe

# Generate variant payloads by substituting a counter into a date field
generate_payload() {
  local idx="$1"
  # Vary the incident_details slightly to ensure unique content hash per request
  cat > "$PAYLOAD_FILE" << 'ENDOFFILE'
{
  "applicationName": "मारपीट की शिकायत",
  "officeType": "thana",
  "promptTemplate": "आवेदन प्रकार: मारपीट की शिकायत (thana कार्यालय)\n\nमहत्वपूर्ण निर्देश:\nयह एक मारपीट (Assault) की शिकायत है। नीचे दिए गए सभी तथ्यों को एक प्रवाहमय कालानुक्रमिक नैरेटिव अनुच्छेद में ढालें। बुलेट पॉइंट न बनाएं।\n\nघटना का वर्णन करते समय:\n- आरोपी कब, कहाँ और कैसे आया\n- क्या शब्द कहे गए (गाली-गलौज का उल्लेख)\n- मारपीट कैसे शुरू हुई और किस हथियार से हुई\n- कहाँ-कहाँ चोट आई\n- किन गवाहों ने देखा\n- चिकित्सीय उपचार कहाँ कराया गया\n\nसिस्टम प्रॉम्प्ट में वर्णित 7-भाग संरचना का सख्ती से पालन करें।\nआवेदिका महिला है, इसलिए निवासिन, भवदीया, रहूँगी, आपकी आभारी आदि स्त्रीलिंग रूपों का प्रयोग करें।\n\nप्रार्थना: आरोपी के विरुद्ध प्राथमिकी दर्ज कर विधिक कार्रवाई की जाए।\n\n——— नीचे दिए गए फॉर्म डेटा का ही प्रयोग करें, कोई अन्य नाम/स्थान न बनाएं ———\n\n{{applicant_name}}\n{{father_husband_name}}\n{{village}}\n{{thana}}\n{{district}}\n{{incident_date}}\n{{incident_time}}\n{{incident_details}}\n{{accused_names}}\n{{injury_details}}\n{{weapons_used}}\n{{medical_report}}\n{{witnesses}}\n{{gender}}",
  "formData": {
    "applicant_name": "सीमा देवी",
    "father_husband_name": "राम प्रसाद",
    "village": "हटकोना",
    "post": "हटकोना",
    "thana": "कटकमसांडी",
    "district": "हजारीबाग",
    "state": "झारखंड",
    "incident_date": "IDX_PLACEHOLDER जुलाई 2026",
    "incident_time": "रात लगभग 9 बजे",
    "incident_details": "कल रात लगभग 9 बजे, जब आवेदिका अपने घर में थी, तभी पड़ोस में रहने वाला रमेश कुमार पिता सुरेश कुमार, ग्राम हटकोना, थाना कटकमसांडी, जिला हजारीबाग आया और बिना किसी कारण के गाली-गलौज करने लगा। जब आवेदिका ने विरोध किया तो रमेश कुमार ने लाठी से आवेदिका के सिर और बाएँ हाथ पर वार किया, जिससे गंभीर चोट आई। (Request #IDX_PLACEHOLDER)",
    "accused_names": "रमेश कुमार पिता सुरेश कुमार, ग्राम हटकोना",
    "injury_details": "सिर में चोट, बाएँ हाथ में सूजन और खरोंच",
    "weapons_used": "लाठी",
    "medical_report": "सामुदायिक स्वास्थ्य केंद्र कटकमसांडी से उपचार कराया गया, मेडिकल रिपोर्ट संलग्न",
    "witnesses": "गाँव के ही रहने वाले सुनील कुमार पिता महेश कुमार एवं किरण देवी पति राजेश कुमार घटना के समय उपस्थित थे",
    "gender": "female",
    "location": "ग्राम हटकोना, आवेदिका का निजी आवास",
    "request_id": "IDX_PLACEHOLDER"
  }
}
ENDOFFILE

  # Substitute the index into the payload
  local day=$(( (idx % 28) + 1 ))
  sed -i "s/IDX_PLACEHOLDER/${day}/g" "$PAYLOAD_FILE"
}

echo "╔════════════════════════════════════════════════╗"
echo "║  DeepSeek Profiling — 30 Requests             ║"
echo "╠════════════════════════════════════════════════╣"
echo "║  Target:  $API_URL"
echo "║  Count:   $COUNT requests"
echo "║  Spacing: ${INTERVAL_SEC}s between requests"
echo "║  Est dur: ~$(( (COUNT * INTERVAL_SEC) / 60 )) minutes"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Header for results file
echo "# DeepSeek Profiling Results — $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$RESULT_FILE"
echo "# Columns: req_num | http_status | duration_seconds | ai_provider | fallback_used | input_tokens | output_tokens" >> "$RESULT_FILE"
echo "#" >> "$RESULT_FILE"

SUCCESS=0
FAIL_HTTP=0
FAIL_NET=0

for i in $(seq 1 $COUNT); do
  echo ""
  echo "──────────────────────────────────────────────────"
  echo "  Request $i / $COUNT  —  $(date '+%H:%M:%S')"
  echo "──────────────────────────────────────────────────"

  generate_payload "$i"

  # Time the curl call
  START_EPOCH=$(date +%s%3N 2>/dev/null || echo 0)

  RESPONSE=$(curl -s -w '\n%{http_code}' \
    -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "@$PAYLOAD_FILE" \
    2>&1 || true)

  END_EPOCH=$(date +%s%3N 2>/dev/null || echo 0)

  # Parse HTTP status (last line of response)
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  # Extract AI metadata from response body
  PROVIDER=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('provider','?'))" 2>/dev/null || echo "parse_err")
  FALLBACK=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('metadata',{}).get('fallbackUsed','?')).lower())" 2>/dev/null || echo "parse_err")
  IN_TOK=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('usage',{}).get('inputTokens',0))" 2>/dev/null || echo "0")
  OUT_TOK=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('usage',{}).get('outputTokens',0))" 2>/dev/null || echo "0")
  DURATION_S=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('durationMs',0)/1000.0)" 2>/dev/null || echo "0")

  # Validate
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✅ HTTP 200 — ${DURATION_S}s — provider=${PROVIDER} — tokens ${IN_TOK}/${OUT_TOK}"
    SUCCESS=$((SUCCESS + 1))
  elif [ "$HTTP_CODE" = "429" ]; then
    echo "  ⚠️  HTTP 429 RATE LIMITED"
    FAIL_HTTP=$((FAIL_HTTP + 1))
  elif [ "$HTTP_CODE" = "500" ] || [ "$HTTP_CODE" = "502" ] || [ "$HTTP_CODE" = "503" ]; then
    echo "  ❌ HTTP ${HTTP_CODE} SERVER ERROR"
    FAIL_HTTP=$((FAIL_HTTP + 1))
  else
    echo "  ❌ HTTP ${HTTP_CODE}"
    FAIL_HTTP=$((FAIL_HTTP + 1))
  fi

  echo "$i | $HTTP_CODE | $DURATION_S | $PROVIDER | $FALLBACK | $IN_TOK | $OUT_TOK" >> "$RESULT_FILE"

  # Don't sleep after the last request
  if [ "$i" -lt "$COUNT" ]; then
    echo "  ⏳ Sleeping ${INTERVAL_SEC}s until next request..."
    sleep "$INTERVAL_SEC"
  fi
done

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  Profiling Run Complete                        ║"
echo "╠════════════════════════════════════════════════╣"
echo "║  Success:   $SUCCESS / $COUNT"
echo "║  HTTP err:  $FAIL_HTTP"
echo "║  Net err:   $FAIL_NET"
echo "╚════════════════════════════════════════════════╝"

# Signal completion with summary
echo "DONE:$SUCCESS:$FAIL_HTTP:$FAIL_NET"
