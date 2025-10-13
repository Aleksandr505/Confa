FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

ENV JAVA_TOOL_OPTIONS="-XX:+ExitOnOutOfMemoryError -XX:MaxRAMPercentage=75"

COPY target/app.jar ./app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]