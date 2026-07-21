# Build stage
FROM openjdk:21-slim AS build
WORKDIR /app
COPY . .
# gradlew 실행 권한 부여 및 빌드 (테스트는 CI 단계 혹은 빌드 시 제외)
RUN chmod +x gradlew && ./gradlew build -x test --no-daemon

# Run stage
FROM openjdk:21-slim
EXPOSE 8080
# plain jar가 아닌 Spring Boot executable jar를 복사합니다.
COPY --from=build /app/build/libs/*[!-plain].jar app.jar
ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-jar", "/app.jar"]
