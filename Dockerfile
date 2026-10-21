FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Retained for compatibility with the existing StartOS wrapper/actions.
ENV PYTHONPATH=/opt/blake-swap/src

WORKDIR /opt/blake-swap

# Install the exact frozen/tested Python release.
COPY vendor-patched/blake_swap-0.2.0-py3-none-any.whl /tmp/blake_swap-0.2.0-py3-none-any.whl

RUN pip install --no-cache-dir \
        /tmp/blake_swap-0.2.0-py3-none-any.whl \
    && rm /tmp/blake_swap-0.2.0-py3-none-any.whl \
    && mkdir -p /opt/blake-swap/src /data \
    && SWAP_V2_PATH="$(python3 -c 'import swap_v2; print(swap_v2.__file__)')" \
    && ln -s "$SWAP_V2_PATH" /opt/blake-swap/src/swap_v2.py

# Keep the existing operator wrappers and Start9 RPC adapters.
COPY upstream-project/scripts/blake ./scripts/blake
COPY upstream-project/scripts/blake-swap ./scripts/blake-swap
COPY adapters ./adapters
COPY diagnostics ./diagnostics
COPY web ./web

RUN chmod +x \
        ./scripts/blake \
        ./scripts/blake-swap \
        ./adapters/blake-rpc-cli \
        ./adapters/btc-rpc-cli

# Web-only startup. Authentication is required, and live status
# remains disabled unless explicitly enabled.
EXPOSE 3000
CMD ["python3", "-u", "web/server.py"]
