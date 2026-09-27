FROM mcr.microsoft.com/azure-functions/node:4-node22

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

WORKDIR /home/site/wwwroot

# The artifact is produced before this image build by the deterministic
# repository helper: node tools/build-swa-api.js --output .azure-production/api
COPY .azure-production/api/ ./

# Install only the locked production dependency graph from the built API.
RUN npm ci --omit=dev

