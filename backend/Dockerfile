FROM maven:3.9.9-eclipse-temurin-17-alpine AS build

WORKDIR /workspace
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre-alpine

RUN addgroup -S dorostudy && adduser -S dorostudy -G dorostudy
WORKDIR /app
COPY --from=build /workspace/target/studyfocus-0.0.1-SNAPSHOT.jar app.jar

USER dorostudy
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=35s --retries=5 \
  CMD wget -q -O - "http://127.0.0.1:${PORT}/api/ping" || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar", "--spring.profiles.active=docker"]
