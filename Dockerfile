FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/opt/blake-swap/src

WORKDIR /opt/blake-swap

COPY upstream-project/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

COPY upstream-project/src/*.py ./src/
COPY upstream-project/scripts/blake ./scripts/blake
COPY upstream-project/scripts/blake-swap ./scripts/blake-swap
COPY adapters ./adapters

RUN chmod +x \
        ./scripts/blake \
        ./scripts/blake-swap \
        ./adapters/blake-rpc-cli \
        ./adapters/btc-rpc-cli \
    && mkdir -p /data


# Alpha-0 deliberately performs no swap, wallet, node, or Nostr action.
# StartOS actions will invoke the CLI explicitly in later milestones.
CMD ["python3", "-c", "import time; time.sleep(1000000000)"]
