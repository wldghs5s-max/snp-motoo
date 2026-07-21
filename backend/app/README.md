# Backend (Spring Boot)

주식 모의투자 API 서버입니다.

## 로컬 실행

### 1. PostgreSQL 준비

- PostgreSQL이 `localhost:5432`에서 실행 중이어야 합니다.
- 기본값은 `postgres` 데이터베이스 / `postgres` 계정 / `postgres` 비밀번호입니다.

### 2. 애플리케이션 실행

기본 프로필이 `local`이므로 별도 옵션 없이 실행하면 됩니다.

```bash
./gradlew bootRun
```

Windows:

```powershell
.\gradlew.bat bootRun
```

### 3. DB 설정 변경 (선택)

`application-local.properties`의 기본값을 바꾸거나, OS 환경 변수로 덮어쓸 수 있습니다.

| 환경 변수     | 로컬 기본값                                      |
|---------------|--------------------------------------------------|
| `DB_URL`      | `jdbc:postgresql://localhost:5432/postgres`      |
| `DB_USERNAME` | `postgres`                                       |
| `DB_PASSWORD` | `postgres`                                       |

PowerShell 예시:

```powershell
$env:DB_URL="jdbc:postgresql://localhost:5432/postgres"
$env:DB_USERNAME="postgres"
$env:DB_PASSWORD="postgres"
.\gradlew.bat bootRun
```

## 운영(prod) 프로필

운영 환경에서는 `prod` 프로필과 DB 환경 변수를 함께 설정합니다.

```bash
export SPRING_PROFILES_ACTIVE=prod
export DB_URL=jdbc:postgresql://<host>:5432/<database>
export DB_USERNAME=<username>
export DB_PASSWORD=<password>
./gradlew bootRun
```
