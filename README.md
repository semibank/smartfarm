# 스마트팜 대시보드

MQTT over WebSocket을 사용한 실시간 스마트팜 센서 데이터 모니터링 대시보드입니다.

## 기능

- 실시간 센서 데이터 모니터링 (온도, 습도, 토양 수분, 조도)
- MQTT WebSocket 연결 상태 표시
- 센서 값에 따른 상태 알림 (정상/경고/위험)
- 실시간 메시지 로그

## 설치 및 실행

```bash
npm install
npm run dev
```

## MQTT 브로커 설정

이 대시보드는 WebSocket을 지원하는 MQTT 브로커가 필요합니다.

### Mosquitto 브로커 설정 (추천)

1. **Mosquitto 설치**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install mosquitto mosquitto-clients
   
   # macOS
   brew install mosquitto
   ```

2. **WebSocket 지원 설정**
   `/etc/mosquitto/mosquitto.conf` 파일에 다음 설정 추가:
   ```
   listener 1883
   protocol mqtt
   
   listener 9001
   protocol websockets
   ```

3. **브로커 시작**
   ```bash
   mosquitto -c /etc/mosquitto/mosquitto.conf
   ```

### 테스트 메시지 전송

브로커가 실행된 후 다음 명령으로 테스트 데이터를 전송할 수 있습니다:

```bash
# 온도 데이터
mosquitto_pub -h localhost -t sensors/temperature -m "23.5"

# 습도 데이터
mosquitto_pub -h localhost -t sensors/humidity -m "65.2"

# 토양 수분 데이터
mosquitto_pub -h localhost -t sensors/soil-moisture -m "45.8"

# 조도 데이터
mosquitto_pub -h localhost -t sensors/light-intensity -m "850"
```

## 설정 변경

`src/components/SmartFarmDashboard.tsx`에서 브로커 URL과 토픽을 변경할 수 있습니다:

```typescript
const { messages, isConnected, connectionStatus } = useMqtt({
  brokerUrl: 'wss://your-broker-url:port',  // 브로커 URL 변경
  topics: [
    'sensors/temperature',
    'sensors/humidity', 
    'sensors/soil-moisture',
    'sensors/light-intensity'
  ],
  options: {
    clientId: `smartfarm_${Math.random().toString(16).substr(2, 8)}`,
    clean: true,
    username: 'your-username',
    password: 'your-password',
  }
});
```

## 센서 상태 기준

- **온도**: 25°C 이상 경고, 30°C 이상 위험
- **습도**: 30% 미만 또는 70% 초과 시 위험, 40% 미만 또는 60% 초과 시 경고
- **토양 수분**: 20% 미만 위험, 30% 미만 경고
- **조도**: 200lux 미만 경고

## 기술 스택

- React 18 + TypeScript
- Vite (빌드 도구)
- MQTT.js (MQTT 클라이언트)
- React Hooks (상태 관리)
