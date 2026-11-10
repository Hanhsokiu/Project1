FROM postgres:17-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libfaketime
COPY postgres-clock /usr/local/acceptance-bin/postgres
RUN chmod 755 /usr/local/acceptance-bin/postgres
# Staging only. Never change the Windows/VM system clock, PostgreSQL functions, triggers or migrations.
ENV TZ=UTC \
    PATH=/usr/local/acceptance-bin:$PATH \
    FAKETIME_TIMESTAMP_FILE=/var/lib/postgresql/data/acceptance.clock \
    FAKETIME_NO_CACHE=1 \
    FAKETIME_DONT_FAKE_MONOTONIC=1
